import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PipelineStage, ResearchReportStatus } from '@repo/db';
import { Queue } from 'bullmq';
import { AiService } from 'src/ai/ai.service';
import { JOBS, QUEUES } from 'src/common/lib/constants';
import { PrismaService } from 'src/common/services/prisma.service';
import { TavilyResult } from 'src/common/types/type';
import { PipelineEventsService } from 'src/pipeline_events/pipeline-events.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { VERIFICATION_SYSTEM_PROMPT, buildEntailmentPrompt } from './entailment.prompt';
import {
  EntailmentCandidate,
  VERIFICATION_METHOD,
  VerificationMetrics,
  entailmentBatchSchema,
  skippedMetrics,
} from './entailment.schema';
import {
  MAX_CRITICISM_QUERIES,
  RESEARCH_SYSTEM_PROMPT,
  buildCriticismQueries,
  buildProductShortlistPrompt,
  buildResearchPrompt,
  buildSearchQueries,
} from './research.prompt';
import { ReportSource, ResearchReportSections, productShortlistSchema, researchReportSchema } from './research.schema';

/**
 * Character budget for the whole search-context block.
 *
 * Sized against a measured budget, not a guess. Groq allows 8,000 tokens per
 * minute for gpt-oss-120b and rejects an over-budget request with
 * `rate_limit_exceeded` / `isRetryable: false`, so exceeding it loses the
 * report outright — which is exactly what adding the criticism searches did
 * (21 sources at a flat 1,200 chars came to ~10,800 tokens).
 *
 * At ~4 chars/token the fixed costs are: system prompt ~580 tokens, JSON schema
 * ~820, and the prompt's own scaffolding ~250. Output is the big and easily
 * underestimated term: stored reports have run from 1,450 to 3,260 tokens, and
 * JSON escaping makes the wire form larger still, so RESERVED_OUTPUT_TOKENS
 * budgets for the worst case rather than the average. Underestimating it
 * truncates the response mid-document, which fails schema validation and loses
 * the report — exactly what happened at a flat 2,500.
 *
 * Measured against the real schema, not estimated: fixed input with an empty
 * context is ~2,050 tokens (prompt scaffold 657, system 580, JSON schema 817).
 * With 8,000 total and 4,000 reserved for output, 5,000 characters of context
 * lands at 7,533-7,948 tokens across 12-30 sources — inside the ceiling at every
 * source count, with margin. 6,000 fits 21 sources but exceeds at 30, so the
 * smaller figure is chosen for headroom rather than to maximise context.
 *
 * The real constraint here is that 8,000 TPM is tight for a 16-field schema. A
 * larger free tier (or a paid one) would allow richer excerpts; this is sized
 * for the tier actually in use.
 */
const MAX_CONTEXT_CHARS = 5_000;

/**
 * Output allowance, sized above the largest report actually observed (3,260
 * tokens) with headroom for JSON escaping and a longer-than-usual run.
 *
 * Passed explicitly so the provider does not infer a smaller cap from whatever
 * is left in the rate-limit window: Groq silently clamps
 * `max_completion_tokens` to the remaining budget, which truncates the document
 * and fails validation with no way to retry.
 */
const RESERVED_OUTPUT_TOKENS = 4_000;

/**
 * Output allowance for the entailment batch: a verdict and one short sentence
 * per claim, so a fraction of a full report.
 */
const ENTAILMENT_OUTPUT_TOKENS = 1_500;

/** A handful of product names — tiny, but capped so it cannot overrun. */
const SHORTLIST_OUTPUT_TOKENS = 300;

/** Ceiling per source, so a few long pages cannot crowd out the rest. */
const MAX_EXCERPT_CHARS = 1_200;

/**
 * Below this an excerpt is too short to establish anything, so the source is
 * listed by title and URL only rather than quoted uselessly. Being explicit
 * beats a truncated fragment the model might still try to cite.
 */
const MIN_EXCERPT_CHARS = 200;

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly access: ProjectAccessService,
    private readonly pipelineEvents: PipelineEventsService,
    @InjectQueue(QUEUES.INCUBATOR) private readonly incubatorQueue: Queue,
  ) {}

  /**
   * Queues generation of a new report version and returns the PENDING row.
   *
   * Always inserts a new version rather than updating: an APPROVED report must
   * survive regeneration. Concurrent calls are blocked by the
   * [projectId, version] unique constraint plus the in-flight check below.
   */
  async requestReport(userId: string, projectId: string) {
    await this.access.assertMember(userId, projectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, description: true, techStack: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    // Refuse to queue a second generation while one is running — it would burn
    // a duplicate set of Tavily credits and LLM calls for the same project.
    const inFlight = await this.prisma.researchReport.findFirst({
      where: { projectId, status: ResearchReportStatus.PENDING },
    });

    if (inFlight) {
      throw new ConflictException('A research report is already being generated for this project.');
    }

    const latest = await this.prisma.researchReport.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const report = await this.prisma.researchReport.create({
      data: {
        projectId,
        version: (latest?.version ?? 0) + 1,
        status: ResearchReportStatus.PENDING,
      },
    });

    await this.incubatorQueue.add(JOBS.DISCOVERY_REPORT, {
      reportId: report.id,
      projectId,
    });

    this.logger.log(`Queued discovery report v${report.version} for project ${projectId} (user ${userId})`);

    return report;
  }

  /**
   * Runs the report: search, generate, validate citations, persist.
   *
   * Called from the BullMQ processor, not from a request. Failures are written
   * to the row as FAILED so the UI can explain them instead of showing a
   * report stuck on PENDING forever.
   */
  async generateReport(reportId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        description: true,
        techStack: true,
        originDump: { select: { rawTranscript: true } },
      },
    });

    if (!project) {
      await this.failReport(reportId, projectId, 'Project no longer exists.');
      return;
    }

    await this.pipelineEvents.emit(
      projectId,
      PipelineStage.DISCOVERY_REPORT_STARTED,
      `Researching comparable products and opportunities for "${project.title}"`,
    );

    try {
      const researchedAt = new Date();
      const queries = buildSearchQueries(project.title, project.description ?? '', project.techStack);

      // Sequential rather than parallel: Tavily free tiers rate-limit, and a
      // 429 storm would lose the whole report rather than one query.
      const results: TavilyResult[] = [];
      const seenUrls = new Set<string>();

      let searchFailures = 0;

      for (const query of queries) {
        const { results: found, failed } = await this.aiService.searchWithStatus(query);
        if (failed) {
          searchFailures++;
        }
        for (const r of found) {
          if (r.url && !seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            results.push(r);
          }
        }
      }

      // A report with no evidence is not a report. Without this, a transient
      // network failure produced a DRAFT with zero sources that sat in the
      // version list looking just like a properly researched one — far worse
      // than an honest failure the user can retry.
      if (searchFailures === queries.length) {
        await this.failReport(
          reportId,
          projectId,
          `Could not reach the web search service (${searchFailures} of ${queries.length} queries failed). ` +
            'No evidence was available, so no report was written. Please try again.',
        );
        return;
      }

      if (searchFailures > 0) {
        this.logger.warn(`Report ${reportId}: ${searchFailures} of ${queries.length} broad searches failed`);
      }

      // Second search stage: criticism of the specific products just found.
      // The broad queries return listicles and vendor pages, which cover
      // strengths and almost never weaknesses — so without this the schema's
      // `weaknesses` field has no evidence behind it and the model fills it
      // from memory. Best-effort: a failure here costs weakness coverage, not
      // the report.
      const criticismQueries = await this.buildProductCriticismQueries(
        project.title,
        project.description ?? '',
        results,
      );

      // Not failure-checked: by here the broad searches have already produced
      // evidence, so a criticism search that cannot be reached costs weakness
      // coverage rather than the report.
      for (const query of criticismQueries) {
        const { results: found } = await this.aiService.searchWithStatus(query);
        for (const r of found) {
          if (r.url && !seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            results.push(r);
          }
        }
      }

      this.logger.log(
        `Report ${reportId}: ${results.length} unique sources from ${queries.length} broad + ` +
          `${criticismQueries.length} criticism quer${criticismQueries.length === 1 ? 'y' : 'ies'}`,
      );

      const sections = await this.aiService.generateStructuredData(
        buildResearchPrompt({
          title: project.title,
          description: project.description ?? '',
          techStack: project.techStack,
          rawTranscript: project.originDump?.rawTranscript,
          searchContext: this.formatSearchContext(results),
          researchDate: researchedAt.toISOString().slice(0, 10),
          // What the user disliked about the last version they rejected, so a
          // regeneration addresses it rather than repeating it.
          rejectionFeedback: await this.latestRejectionFeedback(projectId),
        }),
        researchReportSchema,
        'ResearchReport',
        RESEARCH_SYSTEM_PROMPT,
        RESERVED_OUTPUT_TOKENS,
      );

      const { cleaned, droppedCitations } = this.stripInventedCitations(sections, seenUrls);

      if (droppedCitations > 0) {
        this.logger.warn(`Report ${reportId}: dropped ${droppedCitations} citation(s) not present in search results`);
      }

      // Second pass: a surviving citation proves the URL was retrieved, not
      // that the page supports the claim. This checks the latter.
      const { verified, metrics } = await this.verifyCitations(cleaned, results, droppedCitations);

      if (metrics.demoted > 0) {
        this.logger.warn(
          `Report ${reportId}: demoted ${metrics.demoted} of ${metrics.checked} cited claim(s) not supported by their source`,
        );
      }

      // The user may have cancelled while the searches and generation ran.
      // Checked here, immediately before the write, because a cancel cannot
      // interrupt an in-flight provider call — so the only way to honour it is
      // to discard the result rather than resurrect a CANCELLED row as a DRAFT.
      const current = await this.prisma.researchReport.findUnique({
        where: { id: reportId },
        select: { status: true },
      });

      if (current?.status === ResearchReportStatus.CANCELLED) {
        this.logger.log(`Report ${reportId} was cancelled while generating; discarding the result`);
        return;
      }

      const sources: ReportSource[] = results.map((r) => ({
        title: r.title,
        url: r.url,
        retrievedAt: researchedAt.toISOString(),
      }));

      await this.prisma.researchReport.update({
        where: { id: reportId },
        data: {
          status: ResearchReportStatus.DRAFT,
          sections: verified as unknown as object,
          sources: sources as unknown as object,
          verification: metrics as unknown as object,
          researchedAt,
          model: this.aiService.modelId,
          error: null,
        },
      });

      await this.pipelineEvents.emit(
        projectId,
        PipelineStage.DISCOVERY_REPORT_COMPLETED,
        `Report ready: ${cleaned.comparableProducts.length} comparable product(s), ` +
          `${cleaned.recommendedFeatures.length} recommended feature(s), ${sources.length} source(s)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Report ${reportId} failed: ${message}`);
      await this.failReport(reportId, projectId, message);
    }
  }

  /** Latest report for a project, whatever its status. */
  async getLatestReport(userId: string, projectId: string) {
    await this.access.assertMember(userId, projectId);

    return this.prisma.researchReport.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
  }

  /** Version list, newest first, without the bulky sections payload. */
  async listReportVersions(userId: string, projectId: string) {
    await this.access.assertMember(userId, projectId);

    return this.prisma.researchReport.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        status: true,
        researchedAt: true,
        model: true,
        error: true,
        createdAt: true,
      },
    });
  }

  async getReportVersion(userId: string, projectId: string, version: number) {
    await this.access.assertMember(userId, projectId);

    const report = await this.prisma.researchReport.findUnique({
      where: { projectId_version: { projectId, version } },
    });

    if (!report) {
      throw new NotFoundException(`Report version ${version} not found.`);
    }

    return report;
  }

  /**
   * Marks a DRAFT as APPROVED. Earlier approvals are demoted to DRAFT so that
   * "the approved report" is unambiguous, while their content is preserved.
   */
  async approveReport(userId: string, projectId: string, version: number) {
    await this.access.assertMember(userId, projectId);

    const report = await this.prisma.researchReport.findUnique({
      where: { projectId_version: { projectId, version } },
    });

    if (!report) {
      throw new NotFoundException(`Report version ${version} not found.`);
    }

    if (report.status === ResearchReportStatus.PENDING) {
      throw new ConflictException('That report is still being generated.');
    }

    if (report.status === ResearchReportStatus.FAILED) {
      throw new ConflictException('A failed report cannot be approved.');
    }

    const [, approved] = await this.prisma.$transaction([
      this.prisma.researchReport.updateMany({
        where: { projectId, status: ResearchReportStatus.APPROVED },
        data: { status: ResearchReportStatus.DRAFT },
      }),
      this.prisma.researchReport.update({
        where: { id: report.id },
        // Clears any earlier rejection: approving a version the user had turned
        // down is a reversal, and a stale reason would otherwise keep steering
        // every future regeneration.
        data: { status: ResearchReportStatus.APPROVED, rejectionReason: null },
      }),
    ]);

    return approved;
  }

  /**
   * Asks which real products the broad search turned up, then builds criticism
   * queries for them.
   *
   * One cheap LLM call. Returns an empty list on any failure, so a report still
   * generates — it simply has less sourced weakness evidence, which the
   * verification metrics will then show honestly rather than hide.
   */
  private async buildProductCriticismQueries(
    title: string,
    description: string,
    results: TavilyResult[],
  ): Promise<string[]> {
    if (results.length === 0) {
      return [];
    }

    try {
      const shortlist = await this.aiService.generateStructuredData(
        buildProductShortlistPrompt(title, description, this.formatSearchContext(results)),
        productShortlistSchema,
        'ProductShortlist',
        'You extract product names from search results. You never invent names.',
        // A handful of names; capped so this cannot eat the report's budget.
        SHORTLIST_OUTPUT_TOKENS,
      );

      const queries = buildCriticismQueries(shortlist.products);

      if (queries.length > 0) {
        this.logger.log(`Criticism searches for: ${shortlist.products.slice(0, MAX_CRITICISM_QUERIES).join(', ')}`);
      }

      return queries;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Could not build criticism queries, continuing without them: ${message}`);
      return [];
    }
  }

  /**
   * Checks each cited claim against the excerpt of the page it cites, and
   * demotes the ones the excerpt does not support.
   *
   * This closes the gap left by stripInventedCitations, which only proves a URL
   * was retrieved. In practice the first pass cites a page for a product's
   * strengths and then fills in weaknesses from the model's own knowledge while
   * carrying the same URL along — so the citation implies support the page does
   * not give. Observed on real reports, not hypothetical.
   *
   * Costs ONE extra LLM call per report (all claims batched) and zero extra
   * search calls: the excerpts come from the Tavily results already in memory.
   * On any failure the report is kept exactly as it was, with metrics recording
   * that the check did not run — the main generation and the search credits are
   * already spent, so losing the report over a verification call would be the
   * worst outcome. The UI reads `ran` and must not claim verification when false.
   */
  private async verifyCitations(
    sections: ResearchReportSections,
    results: TavilyResult[],
    inventedCitations: number,
  ): Promise<{ verified: ResearchReportSections; metrics: VerificationMetrics }> {
    // The excerpt each claim is judged against, keyed by URL.
    //
    // Budgeted like the writer's context, and for the same reason: this batches
    // every cited claim with its excerpt into one request, so on a report with
    // many citations an unbudgeted version would exceed the per-minute token
    // limit and the check would be skipped entirely. A shorter excerpt can only
    // make the judge stricter (less text to support a claim), which is the safe
    // direction — it under-claims rather than over-claims.
    const excerptByUrl = new Map<string, string>();
    const citedUrlCount = new Set(
      [
        ...sections.gapsAndOpportunities.filter((c) => c.kind === 'VERIFIED' && c.sourceUrl).map((c) => c.sourceUrl),
        ...sections.comparableProducts.filter((p) => p.sourceUrl && p.weaknesses.length > 0).map((p) => p.sourceUrl),
      ].filter((url): url is string => url !== null),
    ).size;

    const perExcerpt = Math.min(
      MAX_EXCERPT_CHARS,
      citedUrlCount > 0 ? Math.floor(MAX_CONTEXT_CHARS / citedUrlCount) : MAX_EXCERPT_CHARS,
    );

    for (const r of results) {
      if (r.url) {
        excerptByUrl.set(r.url, (r.content || r.snippet || '').slice(0, perExcerpt));
      }
    }

    const candidates: EntailmentCandidate[] = [];

    // Position in its own array, so a verdict maps back without re-deriving
    // which items were eligible. Recomputing that twice is how an off-by-one
    // would strip the evidence off the wrong claim.
    const gapCandidateAt = new Map<number, number>();
    const productCandidateAt = new Map<number, number>();

    sections.gapsAndOpportunities.forEach((claim, position) => {
      if (claim.kind === 'VERIFIED' && claim.sourceUrl) {
        const excerpt = excerptByUrl.get(claim.sourceUrl);
        if (excerpt) {
          gapCandidateAt.set(position, candidates.length);
          candidates.push({
            index: candidates.length,
            location: 'gapsAndOpportunities',
            claim: claim.text,
            sourceUrl: claim.sourceUrl,
            excerpt,
          });
        }
      }
    });

    // A product card carries one URL for the whole entry, so the claim put to
    // the judge is the weaknesses list — that is the part found to outrun its
    // source. Strengths generally do come from the page.
    sections.comparableProducts.forEach((product, position) => {
      if (product.sourceUrl && product.weaknesses.length > 0) {
        const excerpt = excerptByUrl.get(product.sourceUrl);
        if (excerpt) {
          productCandidateAt.set(position, candidates.length);
          candidates.push({
            index: candidates.length,
            location: 'comparableProducts',
            claim: `${product.name} has these weaknesses: ${product.weaknesses.join('; ')}`,
            sourceUrl: product.sourceUrl,
            excerpt,
          });
        }
      }
    });

    if (candidates.length === 0) {
      return {
        verified: sections,
        metrics: skippedMetrics('No cited claims to check.', inventedCitations),
      };
    }

    let judgements: { index: number; verdict: string; reason: string }[];

    try {
      const response = await this.aiService.generateStructuredData(
        buildEntailmentPrompt(candidates),
        entailmentBatchSchema,
        'EntailmentBatch',
        VERIFICATION_SYSTEM_PROMPT,
        // One short judgement per claim, so far less than a full report.
        ENTAILMENT_OUTPUT_TOKENS,
      );
      judgements = response.judgements;
    } catch (error) {
      // Rate limit, timeout, or a malformed batch. Keep the report.
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Citation verification did not run: ${message}`);
      return {
        verified: sections,
        metrics: skippedMetrics(`Verification call failed: ${message.slice(0, 200)}`, inventedCitations),
      };
    }

    const verdictByIndex = new Map<number, string>();
    for (const judgement of judgements) {
      verdictByIndex.set(judgement.index, judgement.verdict);
    }

    let supported = 0;
    let notSupported = 0;
    let contradicted = 0;

    /**
     * A claim with no verdict is left alone rather than demoted: a model that
     * returns a short batch should not silently strip evidence. It counts as
     * unchecked, which the metrics reflect via `checked`.
     */
    const failed = new Set<number>();

    for (const candidate of candidates) {
      const verdict = verdictByIndex.get(candidate.index);
      if (verdict === 'SUPPORTED') {
        supported++;
      } else if (verdict === 'CONTRADICTED') {
        contradicted++;
        failed.add(candidate.index);
      } else if (verdict === 'NOT_SUPPORTED') {
        notSupported++;
        failed.add(candidate.index);
      }
    }

    const gapsAndOpportunities = sections.gapsAndOpportunities.map((claim, position) => {
      const candidateIndex = gapCandidateAt.get(position);
      if (candidateIndex !== undefined && failed.has(candidateIndex)) {
        return { ...claim, kind: 'ANALYSIS' as const, sourceUrl: null };
      }
      return claim;
    });

    const comparableProducts = sections.comparableProducts.map((product, position) => {
      const candidateIndex = productCandidateAt.get(position);
      if (candidateIndex !== undefined && failed.has(candidateIndex)) {
        // The name and strengths keep their citation; only the unsupported
        // part is flagged, so the UI can show the weaknesses without
        // presenting them as sourced.
        return { ...product, weaknessesUnverified: true };
      }
      return product;
    });

    return {
      verified: { ...sections, gapsAndOpportunities, comparableProducts },
      metrics: {
        ran: true,
        inventedCitations,
        checked: candidates.length,
        supported,
        notSupported,
        contradicted,
        demoted: failed.size,
        method: VERIFICATION_METHOD,
        verifiedAt: new Date().toISOString(),
        model: this.aiService.modelId,
      },
    };
  }

  /**
   * Records that the user turned this version down.
   *
   * Kept readable rather than deleted: the version history is the audit trail
   * for what the pipeline produced and what was caught, which is worth more
   * than a tidy list. The reason, when given, is fed into the next generation
   * (see buildResearchPrompt) so rejecting improves the next attempt instead of
   * only recording a verdict.
   *
   * An APPROVED version can still be rejected — a user may change their mind on
   * a closer read — but a PENDING one cannot, since there is nothing to judge.
   */
  async rejectReport(userId: string, projectId: string, version: number, reason?: string) {
    await this.access.assertMember(userId, projectId);

    const report = await this.prisma.researchReport.findUnique({
      where: { projectId_version: { projectId, version } },
    });

    if (!report) {
      throw new NotFoundException(`Report version ${version} not found.`);
    }

    if (report.status === ResearchReportStatus.PENDING) {
      throw new ConflictException('That report is still being generated.');
    }

    if (report.status === ResearchReportStatus.FAILED) {
      throw new ConflictException('A failed report has nothing to reject.');
    }

    const trimmed = reason?.trim();

    return this.prisma.researchReport.update({
      where: { id: report.id },
      data: {
        status: ResearchReportStatus.REJECTED,
        // Truncated for the same reason as `error`: this reaches a prompt.
        rejectionReason: trimmed ? trimmed.slice(0, 1000) : null,
      },
    });
  }

  /**
   * Stops a report that is still generating.
   *
   * Removes the queued job when it has not started, which costs nothing at all.
   * Once the job is running there is no way to claw back an in-flight provider
   * call, so the row is marked CANCELLED and the result discarded when it
   * arrives — see the status check in generateReport. Either way the in-flight
   * guard in requestReport clears immediately, so the user can start another.
   *
   * The row is kept rather than deleted: the version history is the record of
   * what was attempted, and the same argument applies as for REJECTED.
   */
  async cancelReport(userId: string, projectId: string, version: number) {
    await this.access.assertMember(userId, projectId);

    const report = await this.prisma.researchReport.findUnique({
      where: { projectId_version: { projectId, version } },
    });

    if (!report) {
      throw new NotFoundException(`Report version ${version} not found.`);
    }

    // Only a PENDING report is running. Anything else has already settled, and
    // cancelling it would throw away a finished result.
    if (report.status !== ResearchReportStatus.PENDING) {
      throw new ConflictException(`That report is not generating (status: ${report.status}).`);
    }

    // Best-effort: a job that has already started cannot be removed, and a job
    // that has finished is gone. Neither is a reason to fail the cancel, since
    // the status check in generateReport discards the result regardless.
    try {
      const jobs = await this.incubatorQueue.getJobs(['waiting', 'delayed', 'prioritized']);
      for (const job of jobs) {
        const data = job.data as { reportId?: string };
        if (data?.reportId === report.id) {
          await job.remove();
          this.logger.log(`Removed queued discovery report job for report ${report.id}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Could not remove queued job for report ${report.id}: ${message}`);
    }

    const cancelled = await this.prisma.researchReport.update({
      where: { id: report.id },
      data: { status: ResearchReportStatus.CANCELLED },
    });

    await this.pipelineEvents.emit(
      projectId,
      PipelineStage.DISCOVERY_REPORT_FAILED,
      `Report v${version} was cancelled.`,
    );

    return cancelled;
  }

  /**
   * The most recent rejection's reason, for steering the next generation.
   *
   * Only the latest is used. Stacking every past rejection into one prompt
   * would grow without bound and let a stale complaint about v1 distort v9.
   */
  private async latestRejectionFeedback(projectId: string): Promise<string | undefined> {
    const rejected = await this.prisma.researchReport.findFirst({
      where: {
        projectId,
        status: ResearchReportStatus.REJECTED,
        rejectionReason: { not: null },
      },
      orderBy: { version: 'desc' },
      select: { version: true, rejectionReason: true },
    });

    return rejected?.rejectionReason ?? undefined;
  }

  private async failReport(reportId: string, projectId: string, message: string): Promise<void> {
    // A cancelled report must not be rewritten as FAILED: the user stopped it
    // deliberately, and showing them an error afterwards would be wrong.
    const current = await this.prisma.researchReport.findUnique({
      where: { id: reportId },
      select: { status: true },
    });

    if (current?.status === ResearchReportStatus.CANCELLED) {
      this.logger.log(`Report ${reportId} failed after being cancelled; leaving it CANCELLED`);
      return;
    }

    await this.prisma.researchReport.update({
      where: { id: reportId },
      // Truncated: provider errors can carry very long bodies.
      data: { status: ResearchReportStatus.FAILED, error: message.slice(0, 2000) },
    });

    await this.pipelineEvents.emit(
      projectId,
      PipelineStage.DISCOVERY_REPORT_FAILED,
      'Could not generate the research report. You can try again.',
    );
  }

  /**
   * Numbered, URL-bearing context so the model can cite exactly.
   *
   * Budgeted rather than unbounded. Free tiers cap tokens per minute — Groq's
   * is 8,000 — and an oversized request is rejected as non-retryable, so an
   * unbudgeted context loses the whole report the moment a search returns more
   * results than usual. Adding the criticism searches did exactly that: 21
   * sources at the old flat 1,200-char cap came to ~10,800 tokens.
   *
   * Every source still appears, so nothing silently vanishes from the evidence
   * the model can cite; the per-source excerpt shrinks instead, down to a floor
   * below which a snippet is too short to support a claim. Past that floor the
   * remaining sources are listed by title and URL only.
   */
  private formatSearchContext(results: TavilyResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const budget = Math.floor(MAX_CONTEXT_CHARS / results.length);
    const perSource = Math.min(MAX_EXCERPT_CHARS, Math.max(budget, 0));

    return results
      .map((r, i) => {
        const head = `[${i + 1}] ${r.title}\nURL: ${r.url}`;
        if (perSource < MIN_EXCERPT_CHARS) {
          return head;
        }
        const body = (r.content || r.snippet || '').slice(0, perSource);
        return `${head}\n${body}`;
      })
      .join('\n\n');
  }

  /**
   * Demotes any VERIFIED claim whose sourceUrl was not actually retrieved.
   *
   * The prompt forbids inventing URLs, but a prompt is not a guarantee. A
   * fabricated citation is the single most damaging output this feature could
   * produce, so unverifiable claims are relabelled ANALYSIS and their link
   * removed rather than shown to the user as evidence.
   */
  private stripInventedCitations(
    sections: ResearchReportSections,
    allowedUrls: Set<string>,
  ): { cleaned: ResearchReportSections; droppedCitations: number } {
    let dropped = 0;

    const isAllowed = (url: string | null): boolean => {
      if (!url) return false;
      if (allowedUrls.has(url)) return true;
      // Tolerate a trailing-slash difference, which models add freely.
      const trimmed = url.replace(/\/+$/, '');
      return allowedUrls.has(trimmed) || allowedUrls.has(`${trimmed}/`);
    };

    const cleaned: ResearchReportSections = {
      ...sections,
      gapsAndOpportunities: sections.gapsAndOpportunities.map((c) => {
        if (c.kind === 'VERIFIED' && !isAllowed(c.sourceUrl)) {
          dropped++;
          return { ...c, kind: 'ANALYSIS' as const, sourceUrl: null };
        }
        return c;
      }),
      comparableProducts: sections.comparableProducts.map((p) => {
        if (p.sourceUrl && !isAllowed(p.sourceUrl)) {
          dropped++;
          return { ...p, sourceUrl: null };
        }
        return p;
      }),
    };

    return { cleaned, droppedCitations: dropped };
  }
}
