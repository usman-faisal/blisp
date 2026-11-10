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
import { RESEARCH_SYSTEM_PROMPT, buildResearchPrompt, buildSearchQueries } from './research.prompt';
import { ReportSource, ResearchReportSections, researchReportSchema } from './research.schema';

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

      for (const query of queries) {
        const found = await this.aiService.search(query);
        for (const r of found) {
          if (r.url && !seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            results.push(r);
          }
        }
      }

      this.logger.log(`Report ${reportId}: ${results.length} unique sources from ${queries.length} queries`);

      const sections = await this.aiService.generateStructuredData(
        buildResearchPrompt({
          title: project.title,
          description: project.description ?? '',
          techStack: project.techStack,
          rawTranscript: project.originDump?.rawTranscript,
          searchContext: this.formatSearchContext(results),
          researchDate: researchedAt.toISOString().slice(0, 10),
        }),
        researchReportSchema,
        'ResearchReport',
        RESEARCH_SYSTEM_PROMPT,
      );

      const { cleaned, droppedCitations } = this.stripInventedCitations(sections, seenUrls);

      if (droppedCitations > 0) {
        this.logger.warn(`Report ${reportId}: dropped ${droppedCitations} citation(s) not present in search results`);
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
          sections: cleaned as unknown as object,
          sources: sources as unknown as object,
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
        data: { status: ResearchReportStatus.APPROVED },
      }),
    ]);

    return approved;
  }

  private async failReport(reportId: string, projectId: string, message: string): Promise<void> {
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

  /** Numbered, URL-bearing context so the model can cite exactly. */
  private formatSearchContext(results: TavilyResult[]): string {
    return results
      .map((r, i) => {
        const body = (r.content || r.snippet || '').slice(0, 1200);
        return `[${i + 1}] ${r.title}\nURL: ${r.url}\n${body}`;
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
