import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PipelineStage, ResearchReportStatus } from '@repo/db';
import { AiService } from 'src/ai/ai.service';
import { QUEUES } from 'src/common/lib/constants';
import { PrismaService } from 'src/common/services/prisma.service';
import { PipelineEventsService } from 'src/pipeline_events/pipeline-events.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { ResearchService } from '../research.service';
import { ResearchReportSections, researchReportSchema } from '../research.schema';
import { VerificationMetrics } from '../entailment.schema';

/**
 * Report generation, versioning and citation integrity.
 *
 * The citation tests matter most: a fabricated source URL shown to the user as
 * evidence is the worst thing this feature could do, and the prompt alone
 * cannot prevent it.
 */
describe('ResearchService', () => {
  const USER_ID = 'user-1';
  const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
  const REPORT_ID = '22222222-2222-2222-2222-222222222222';

  /** A schema-valid report, so tests exercise real validation. */
  function validSections(overrides: Partial<ResearchReportSections> = {}): ResearchReportSections {
    return {
      executiveSummary: 'A focused LMS for one university.',
      ideaSummary: 'A learning management system.',
      assumptions: ['Single university deployment'],
      problemStatement: 'Existing systems are hard to use.',
      targetUsers: ['Lecturers', 'Students'],
      comparableProducts: [
        {
          name: 'Moodle',
          whatItDoesWell: ['Extensible plugins'],
          weaknesses: ['Dated interface'],
          sourceUrl: 'https://moodle.org/about',
        },
      ],
      featuresWorthAdopting: [
        { feature: 'Gradebook', whyItMattersHere: 'Lecturers need marks', priority: 'MUST_HAVE' },
      ],
      gapsAndOpportunities: [
        { text: 'No mobile-first option', kind: 'VERIFIED', sourceUrl: 'https://moodle.org/about' },
      ],
      recommendedFeatures: [
        { feature: 'Mobile attendance', whyItMattersHere: 'Students use phones', priority: 'MUST_HAVE' },
      ],
      differentiators: ['Built for one institution workflow'],
      mvpScope: { mustHave: ['Auth'], shouldHave: ['Grades'], later: ['Analytics'] },
      technicalFeasibility: {
        summary: 'Achievable with a standard web stack.',
        suggestedStack: ['NestJS'],
        architectureNotes: ['Start monolithic'],
      },
      risks: [{ risk: 'Scope creep', severity: 'MEDIUM', mitigation: 'Freeze the MVP list' }],
      roughEffort: 'About six weeks part-time.',
      openQuestions: ['Which SSO provider?'],
      evidenceGaps: ['No pricing data found'],
      ...overrides,
    };
  }

  /**
   * What the service writes to the report row. Declared so assertions can read
   * the persisted payload type-safely instead of poking at an `any` mock.
   */
  interface SavedReport {
    status: ResearchReportStatus;
    sections: ResearchReportSections;
    sources: { title: string; url: string; retrievedAt: string }[];
    verification: VerificationMetrics;
    researchedAt: Date;
    model: string;
    error: string | null;
  }

  /** The `data` passed to the Nth researchReport.update call. */
  function savedData(mocks: ReturnType<typeof buildMocks>, call = 0): SavedReport {
    return mocks.prisma.researchReport.update.mock.calls[call][0].data;
  }

  function buildMocks() {
    return {
      prisma: {
        project: { findUnique: jest.fn() },
        researchReport: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn() as jest.Mock<
            Promise<{ id: string; version: number }>,
            [{ data: { projectId: string; version: number } }]
          >,
          update: jest.fn() as jest.Mock<unknown, [{ data: SavedReport }]>,
          updateMany: jest.fn(),
        },
        $transaction: jest.fn(),
      },
      ai: {
        search: jest.fn().mockResolvedValue([]),
        // The report pipeline uses searchWithStatus so it can tell "found
        // nothing" from "could not reach the service".
        searchWithStatus: jest.fn().mockResolvedValue({ results: [], failed: false }),
        generateStructuredData: jest.fn(),
        modelId: 'test-model',
      },
      access: { assertMember: jest.fn().mockResolvedValue({}) },
      pipeline: { emit: jest.fn().mockResolvedValue(undefined) },
      queue: {
        add: jest.fn().mockResolvedValue({ id: 'job-1' }),
        getJobs: jest.fn().mockResolvedValue([]),
      },
    };
  }

  async function build(mocks: ReturnType<typeof buildMocks>): Promise<ResearchService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResearchService,
        { provide: PrismaService, useValue: mocks.prisma },
        { provide: AiService, useValue: mocks.ai },
        { provide: ProjectAccessService, useValue: mocks.access },
        { provide: PipelineEventsService, useValue: mocks.pipeline },
        { provide: getQueueToken(QUEUES.INCUBATOR), useValue: mocks.queue },
      ],
    }).compile();

    return module.get(ResearchService);
  }

  describe('schema guardrails', () => {
    // The product rule "never reject an idea because competitors exist" is
    // enforced structurally, not just in prose the model may ignore.
    it('rejects a report with no recommended features', () => {
      const result = researchReportSchema.safeParse(validSections({ recommendedFeatures: [] }));
      expect(result.success).toBe(false);
    });

    it('rejects a report with no differentiators', () => {
      const result = researchReportSchema.safeParse(validSections({ differentiators: [] }));
      expect(result.success).toBe(false);
    });

    it('rejects an MVP with nothing to build', () => {
      const result = researchReportSchema.safeParse(
        validSections({ mvpScope: { mustHave: [], shouldHave: [], later: [] } }),
      );
      expect(result.success).toBe(false);
    });

    it('accepts a well-formed report', () => {
      expect(researchReportSchema.safeParse(validSections()).success).toBe(true);
    });
  });

  describe('requestReport', () => {
    it('enforces project membership before doing anything', async () => {
      const mocks = buildMocks();
      mocks.access.assertMember.mockRejectedValue(new NotFoundException());
      const service = await build(mocks);

      await expect(service.requestReport(USER_ID, PROJECT_ID)).rejects.toThrow(NotFoundException);
      expect(mocks.queue.add).not.toHaveBeenCalled();
    });

    it('404s when the project does not exist', async () => {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue(null);
      const service = await build(mocks);

      await expect(service.requestReport(USER_ID, PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it('refuses to queue a second report while one is pending', async () => {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID, title: 'X', techStack: [] });
      mocks.prisma.researchReport.findFirst.mockResolvedValue({ id: 'existing' });
      const service = await build(mocks);

      await expect(service.requestReport(USER_ID, PROJECT_ID)).rejects.toThrow(ConflictException);
      expect(mocks.queue.add).not.toHaveBeenCalled();
    });

    it('starts at version 1 for a project with no reports', async () => {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID, title: 'X', techStack: [] });
      mocks.prisma.researchReport.findFirst
        .mockResolvedValueOnce(null) // in-flight check
        .mockResolvedValueOnce(null); // latest version
      mocks.prisma.researchReport.create.mockResolvedValue({ id: REPORT_ID, version: 1 });
      const service = await build(mocks);

      await service.requestReport(USER_ID, PROJECT_ID);

      expect(mocks.prisma.researchReport.create.mock.calls[0][0].data.version).toBe(1);
    });

    // The plan forbids silently destroying an approved report.
    it('increments the version instead of overwriting an existing report', async () => {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID, title: 'X', techStack: [] });
      mocks.prisma.researchReport.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ version: 3 });
      mocks.prisma.researchReport.create.mockResolvedValue({ id: REPORT_ID, version: 4 });
      const service = await build(mocks);

      await service.requestReport(USER_ID, PROJECT_ID);

      expect(mocks.prisma.researchReport.create.mock.calls[0][0].data.version).toBe(4);
      expect(mocks.prisma.researchReport.update).not.toHaveBeenCalled();
    });
  });

  describe('generateReport — citation integrity', () => {
    /**
     * Wires a successful generation returning `sections` over `urls`.
     *
     * Generation makes two structured calls: the report, then the citation
     * entailment batch. `verdicts` controls the second — the default marks
     * everything SUPPORTED so these tests isolate URL-provenance behaviour
     * from entailment behaviour, which has its own describe block.
     */
    async function runWith(
      sections: ResearchReportSections,
      urls: string[],
      verdicts?: { index: number; verdict: string; reason: string }[] | Error,
    ) {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'Uni LMS',
        description: 'An LMS',
        techStack: ['NestJS'],
        originDump: { rawTranscript: 'I want to build an LMS' },
      });
      mocks.ai.searchWithStatus.mockResolvedValue({
        results: urls.map((url, i) => ({ title: `R${i}`, url, content: 'body', score: 1 })),
        failed: false,
      });

      mocks.ai.generateStructuredData.mockImplementation((_prompt, _schema, schemaName: string) => {
        if (schemaName === 'ProductShortlist') {
          // No criticism searches: these tests isolate citation behaviour.
          return Promise.resolve({ products: [] });
        }
        if (schemaName === 'EntailmentBatch') {
          if (verdicts instanceof Error) return Promise.reject(verdicts);
          if (verdicts) return Promise.resolve({ judgements: verdicts });
          // Default: approve everything, so provenance tests stay isolated.
          return Promise.resolve({
            judgements: [0, 1, 2, 3, 4, 5].map((index) => ({
              index,
              verdict: 'SUPPORTED',
              reason: 'stated',
            })),
          });
        }
        return Promise.resolve(sections);
      });

      const service = await build(mocks);

      await service.generateReport(REPORT_ID, PROJECT_ID);

      return mocks;
    }

    it('keeps a VERIFIED claim whose URL was actually retrieved', async () => {
      const mocks = await runWith(validSections(), ['https://moodle.org/about']);

      const saved = savedData(mocks);
      expect(saved.status).toBe(ResearchReportStatus.DRAFT);
      expect(saved.sections.gapsAndOpportunities[0].kind).toBe('VERIFIED');
      expect(saved.sections.gapsAndOpportunities[0].sourceUrl).toBe('https://moodle.org/about');
    });

    // A model inventing a plausible URL is the failure mode that would mislead
    // the user most, so the claim is demoted rather than shown as evidence.
    it('demotes a VERIFIED claim citing a URL that was never retrieved', async () => {
      const mocks = await runWith(
        validSections({
          gapsAndOpportunities: [{ text: 'Invented', kind: 'VERIFIED', sourceUrl: 'https://fake.example.com/made-up' }],
        }),
        ['https://moodle.org/about'],
      );

      const saved = savedData(mocks);
      expect(saved.sections.gapsAndOpportunities[0].kind).toBe('ANALYSIS');
      expect(saved.sections.gapsAndOpportunities[0].sourceUrl).toBeNull();
    });

    it('clears an invented product sourceUrl', async () => {
      const mocks = await runWith(
        validSections({
          comparableProducts: [
            {
              name: 'Ghost',
              whatItDoesWell: ['x'],
              weaknesses: [],
              sourceUrl: 'https://not-retrieved.example.com',
            },
          ],
        }),
        ['https://moodle.org/about'],
      );

      const saved = savedData(mocks);
      expect(saved.sections.comparableProducts[0].sourceUrl).toBeNull();
      // The product itself survives — only its unverifiable citation goes.
      expect(saved.sections.comparableProducts[0].name).toBe('Ghost');
    });

    it('tolerates a trailing-slash difference rather than dropping the citation', async () => {
      const mocks = await runWith(
        validSections({
          gapsAndOpportunities: [{ text: 'Real', kind: 'VERIFIED', sourceUrl: 'https://moodle.org/about/' }],
        }),
        ['https://moodle.org/about'],
      );

      const saved = savedData(mocks);
      expect(saved.sections.gapsAndOpportunities[0].kind).toBe('VERIFIED');
    });

    it('records every retrieved source with a retrieval timestamp', async () => {
      const mocks = await runWith(validSections(), ['https://moodle.org/about']);

      const saved = savedData(mocks);
      expect(saved.sources).toHaveLength(1);
      expect(saved.sources[0]).toMatchObject({ url: 'https://moodle.org/about' });
      expect(saved.sources[0].retrievedAt).toBeTruthy();
      expect(saved.researchedAt).toBeInstanceOf(Date);
      expect(saved.model).toBe('test-model');
    });

    it('deduplicates URLs returned by more than one query', async () => {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'X',
        description: '',
        techStack: [],
        originDump: null,
      });
      // Same URL from all four queries.
      mocks.ai.searchWithStatus.mockResolvedValue({
        results: [{ title: 'Dup', url: 'https://same.example.com', content: 'b', score: 1 }],
        failed: false,
      });
      mocks.ai.generateStructuredData.mockResolvedValue(
        validSections({ gapsAndOpportunities: [], comparableProducts: [] }),
      );
      const service = await build(mocks);

      await service.generateReport(REPORT_ID, PROJECT_ID);

      const saved = savedData(mocks);
      expect(mocks.ai.searchWithStatus).toHaveBeenCalledTimes(4);
      expect(saved.sources).toHaveLength(1);
    });
  });

  /**
   * Citation entailment.
   *
   * stripInventedCitations only proves a URL was retrieved. These cover the
   * second question — does the cited page support the claim — and, most
   * importantly, that a failure of the check never costs the user a report.
   */
  describe('generateReport — citation entailment', () => {
    async function runEntailment(
      sections: ResearchReportSections,
      urls: string[],
      verdicts: { index: number; verdict: string; reason: string }[] | Error,
    ) {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'Uni LMS',
        description: 'An LMS',
        techStack: ['NestJS'],
        originDump: { rawTranscript: 'dump' },
      });
      mocks.ai.searchWithStatus.mockResolvedValue({
        results: urls.map((url, i) => ({ title: `R${i}`, url, content: 'page body', score: 1 })),
        failed: false,
      });
      mocks.ai.generateStructuredData.mockImplementation((_p, _sc, schemaName: string) => {
        if (schemaName === 'ProductShortlist') {
          return Promise.resolve({ products: [] });
        }
        if (schemaName === 'EntailmentBatch') {
          if (verdicts instanceof Error) return Promise.reject(verdicts);
          return Promise.resolve({ judgements: verdicts });
        }
        return Promise.resolve(sections);
      });
      const service = await build(mocks);
      await service.generateReport(REPORT_ID, PROJECT_ID);
      return mocks;
    }

    const URL = 'https://moodle.org/about';

    it('keeps a claim its source supports, and records it as supported', async () => {
      const mocks = await runEntailment(
        validSections(),
        [URL],
        [
          { index: 0, verdict: 'SUPPORTED', reason: 'stated verbatim' },
          { index: 1, verdict: 'SUPPORTED', reason: 'stated verbatim' },
        ],
      );

      const saved = savedData(mocks);
      expect(saved.sections.gapsAndOpportunities[0].kind).toBe('VERIFIED');
      expect(saved.sections.gapsAndOpportunities[0].sourceUrl).toBe(URL);
      expect(saved.verification.ran).toBe(true);
      expect(saved.verification.supported).toBeGreaterThan(0);
      expect(saved.verification.demoted).toBe(0);
    });

    // The real-world failure this check exists for: a plausible claim carrying
    // a citation the page does not actually back.
    it('demotes a claim its source does not mention', async () => {
      const mocks = await runEntailment(
        validSections(),
        [URL],
        [
          { index: 0, verdict: 'NOT_SUPPORTED', reason: 'page does not mention this' },
          { index: 1, verdict: 'SUPPORTED', reason: 'ok' },
        ],
      );

      const saved = savedData(mocks);
      expect(saved.sections.gapsAndOpportunities[0].kind).toBe('ANALYSIS');
      expect(saved.sections.gapsAndOpportunities[0].sourceUrl).toBeNull();
      expect(saved.verification.notSupported).toBe(1);
      expect(saved.verification.demoted).toBe(1);
    });

    it('demotes a claim the source contradicts, and counts it separately', async () => {
      const mocks = await runEntailment(
        validSections(),
        [URL],
        [
          { index: 0, verdict: 'CONTRADICTED', reason: 'page states the opposite' },
          { index: 1, verdict: 'SUPPORTED', reason: 'ok' },
        ],
      );

      const saved = savedData(mocks);
      expect(saved.sections.gapsAndOpportunities[0].kind).toBe('ANALYSIS');
      expect(saved.verification.contradicted).toBe(1);
      expect(saved.verification.notSupported).toBe(0);
      expect(saved.verification.demoted).toBe(1);
    });

    // A product's name and strengths usually DO come from the page; only the
    // weaknesses outran the source. Flag that part rather than dropping the card.
    it('flags unsupported product weaknesses without removing the product citation', async () => {
      const mocks = await runEntailment(
        validSections(),
        [URL],
        [
          { index: 0, verdict: 'SUPPORTED', reason: 'ok' },
          { index: 1, verdict: 'NOT_SUPPORTED', reason: 'no weaknesses on the page' },
        ],
      );

      const saved = savedData(mocks);
      const product = saved.sections.comparableProducts[0];
      expect(product.weaknessesUnverified).toBe(true);
      // Still cited, and the weaknesses text is preserved for the user to judge.
      expect(product.sourceUrl).toBe(URL);
      expect(product.weaknesses.length).toBeGreaterThan(0);
    });

    // The most important test here. The search credits and the main generation
    // are already spent by this point; losing the report to a 429 on the
    // verification call would be the worst possible outcome.
    it('keeps the report when the verification call fails, and says it did not run', async () => {
      const mocks = await runEntailment(validSections(), [URL], new Error('429 rate limit exceeded'));

      const saved = savedData(mocks);
      expect(saved.status).toBe(ResearchReportStatus.DRAFT);
      expect(saved.sections.recommendedFeatures.length).toBeGreaterThan(0);
      // Untouched, not stripped — a failed check must not destroy evidence.
      expect(saved.sections.gapsAndOpportunities[0].kind).toBe('VERIFIED');
      expect(saved.verification.ran).toBe(false);
      expect(saved.verification.skippedReason).toContain('429');
    });

    // A short batch must not be read as "the missing ones failed".
    it('leaves a claim alone when the judge returns no verdict for it', async () => {
      const mocks = await runEntailment(validSections(), [URL], [{ index: 1, verdict: 'SUPPORTED', reason: 'ok' }]);

      const saved = savedData(mocks);
      expect(saved.sections.gapsAndOpportunities[0].kind).toBe('VERIFIED');
      expect(saved.verification.demoted).toBe(0);
    });

    it('records that it did not run when there is nothing to check', async () => {
      const mocks = await runEntailment(
        validSections({
          gapsAndOpportunities: [{ text: 'Analysis only', kind: 'ANALYSIS', sourceUrl: null }],
          comparableProducts: [
            {
              name: 'Moodle',
              whatItDoesWell: ['Plugins'],
              weaknesses: [],
              sourceUrl: null,
            },
          ],
        }),
        [URL],
        [],
      );

      const saved = savedData(mocks);
      expect(saved.verification.ran).toBe(false);
      expect(saved.verification.checked).toBe(0);
      expect(saved.verification.skippedReason).toContain('No cited claims');
    });

    it('carries the invented-citation count into the metrics', async () => {
      const mocks = await runEntailment(
        validSections({
          gapsAndOpportunities: [{ text: 'Faked', kind: 'VERIFIED', sourceUrl: 'https://not-retrieved.example.com/x' }],
        }),
        [URL],
        [{ index: 0, verdict: 'SUPPORTED', reason: 'ok' }],
      );

      const saved = savedData(mocks);
      expect(saved.verification.inventedCitations).toBe(1);
    });

    it('does not spend extra search calls on verification', async () => {
      const mocks = await runEntailment(
        validSections(),
        [URL],
        [
          { index: 0, verdict: 'SUPPORTED', reason: 'ok' },
          { index: 1, verdict: 'SUPPORTED', reason: 'ok' },
        ],
      );

      // Four queries, one per buildSearchQueries entry — and no more.
      expect(mocks.ai.searchWithStatus).toHaveBeenCalledTimes(4);
    });
  });

  /**
   * Two-stage search.
   *
   * The broad queries return listicles that list strengths and not weaknesses,
   * so the schema's `weaknesses` field had no evidence behind it and the model
   * filled it from memory. These cover the follow-up searches that make a
   * product's weaknesses citable.
   */
  describe('generateReport — criticism searches', () => {
    async function runSearch(
      shortlist: { products: string[] } | Error,
      opts: { searchResults?: { title: string; url: string; content: string; score: number }[] } = {},
    ) {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'Basic Todo App',
        description: 'A simple todo app',
        techStack: ['React'],
        originDump: { rawTranscript: 'dump' },
      });
      mocks.ai.searchWithStatus.mockResolvedValue({
        results: opts.searchResults ?? [{ title: 'R', url: 'https://example.com/a', content: 'body', score: 1 }],
        failed: false,
      });
      mocks.ai.generateStructuredData.mockImplementation((_p, _sc, schemaName: string) => {
        if (schemaName === 'ProductShortlist') {
          if (shortlist instanceof Error) return Promise.reject(shortlist);
          return Promise.resolve(shortlist);
        }
        if (schemaName === 'EntailmentBatch') return Promise.resolve({ judgements: [] });
        return Promise.resolve(validSections());
      });
      const service = await build(mocks);
      await service.generateReport(REPORT_ID, PROJECT_ID);
      return mocks;
    }

    function queriesRun(mocks: ReturnType<typeof buildMocks>): string[] {
      return (mocks.ai.searchWithStatus.mock.calls as [string][]).map((call) => call[0]);
    }

    it('searches for criticism of each product the first pass found', async () => {
      const mocks = await runSearch({ products: ['Microsoft To Do', 'Todoist'] });
      const queries = queriesRun(mocks);

      // Four broad, then one per named product.
      expect(queries).toHaveLength(6);
      expect(queries.some((q) => q.includes('Microsoft To Do') && q.includes('complaints'))).toBe(true);
      expect(queries.some((q) => q.includes('Todoist') && q.includes('complaints'))).toBe(true);
    });

    // The whole point: the weakness queries name a product. A generic query
    // returns overviews, which is what caused the uncited weaknesses.
    it('names the product in the criticism query', async () => {
      const mocks = await runSearch({ products: ['Notion'] });
      const criticism = queriesRun(mocks).find((q) => q.includes('Notion') && q.includes('dislike'));

      expect(criticism).toBe('Notion review problems complaints limitations what users dislike');
    });

    // Tavily's free tier is the binding constraint.
    it('caps the number of criticism searches', async () => {
      const mocks = await runSearch({
        products: ['A', 'Bee', 'Cee', 'Dee', 'Eee', 'Eff'],
      });

      expect(queriesRun(mocks)).toHaveLength(4 + 3);
    });

    // Losing weakness coverage is acceptable; losing the report is not.
    it('still produces a report when the shortlist call fails', async () => {
      const mocks = await runSearch(new Error('429 rate limit'));

      const saved = savedData(mocks);
      expect(saved.status).toBe(ResearchReportStatus.DRAFT);
      expect(queriesRun(mocks)).toHaveLength(4);
    });

    it('runs no criticism searches when no products were found', async () => {
      const mocks = await runSearch({ products: [] });
      expect(queriesRun(mocks)).toHaveLength(4);
    });

    // A model echoing a blank or single-character name would waste a query.
    it('ignores blank product names', async () => {
      const mocks = await runSearch({ products: ['', '  ', 'x', 'Todoist'] });

      // Matched on the criticism template, not the word "complaints" — one of
      // the four broad queries contains that word too.
      const criticism = queriesRun(mocks).filter((q) => q.includes('what users dislike'));
      expect(criticism).toHaveLength(1);
      expect(criticism[0]).toContain('Todoist');
    });

    it('skips the shortlist call entirely when search returned nothing', async () => {
      const mocks = await runSearch({ products: ['Ignored'] }, { searchResults: [] });

      const shortlistCalls = (mocks.ai.generateStructuredData.mock.calls as [string, unknown, string][]).filter(
        (call) => call[2] === 'ProductShortlist',
      );
      expect(shortlistCalls).toHaveLength(0);
    });

    it('deduplicates a criticism result that the broad search already found', async () => {
      const mocks = await runSearch({ products: ['Todoist'] });

      const saved = savedData(mocks);
      // Every query returns the same single URL in this setup.
      expect(saved.sources).toHaveLength(1);
    });
  });

  /**
   * Context budget.
   *
   * Free tiers cap tokens per minute and reject an oversized request as
   * non-retryable, so an unbudgeted context loses the whole report. This
   * regressed once already: adding the criticism searches pushed 21 sources at
   * a flat 1,200 chars each to ~10,800 tokens against Groq's 8,000 limit.
   */
  describe('generateReport — search context budget', () => {
    async function promptFor(sourceCount: number) {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'Basic Todo App',
        description: 'A simple todo app',
        techStack: ['React'],
        originDump: { rawTranscript: 'dump' },
      });
      // Distinct long pages per query so dedup cannot hide growth. Seven
      // queries run (4 broad + 3 criticism), so each returns sourceCount/7.
      let n = 0;
      const perQuery = Math.max(1, Math.round(sourceCount / 7));
      mocks.ai.searchWithStatus.mockImplementation(() =>
        Promise.resolve({
          results: Array.from({ length: perQuery }, () => {
            n += 1;
            return { title: `Source ${n}`, url: `https://example.com/${n}`, content: 'y'.repeat(4000), score: 1 };
          }),
          failed: false,
        }),
      );
      mocks.ai.generateStructuredData.mockImplementation((_p, _sc, schemaName: string) => {
        // Real names: buildCriticismQueries drops anything 1 char or shorter,
        // so single letters would silently skip the criticism searches.
        if (schemaName === 'ProductShortlist') return Promise.resolve({ products: ['Todoist', 'Notion', 'TickTick'] });
        if (schemaName === 'EntailmentBatch') return Promise.resolve({ judgements: [] });
        return Promise.resolve(validSections());
      });
      const service = await build(mocks);
      await service.generateReport(REPORT_ID, PROJECT_ID);

      const calls = mocks.ai.generateStructuredData.mock.calls as [string, unknown, string][];
      return calls.find((call) => call[2] === 'ResearchReport')?.[0] ?? '';
    }

    it('keeps the prompt within the tightest free-tier budget', async () => {
      const prompt = await promptFor(21);

      // ~4 chars/token. The prompt is the bulk of the request; the system
      // prompt, schema and output make up the rest of the 8,000-token ceiling.
      expect(Math.ceil(prompt.length / 4)).toBeLessThan(4_000);
    });

    // The point of a budget rather than a source cap: quadrupling the sources
    // must not quadruple the request. Growth is limited to the per-source
    // title/URL headers, which sit outside the excerpt budget.
    it('does not grow the prompt proportionally to source count', async () => {
      const small = await promptFor(7);
      const large = await promptFor(28);

      expect(large.length).toBeLessThan(small.length * 2);
    });

    // Every source stays citable; only its excerpt shrinks. Nothing is dropped
    // from the evidence the model is allowed to cite.
    it('still lists every source so each one can be cited', async () => {
      const prompt = await promptFor(21);

      const listed = (prompt.match(/^\[\d+\] Source /gm) ?? []).length;
      const urls = (prompt.match(/https:\/\/example\.com\//g) ?? []).length;

      expect(listed).toBe(21);
      expect(urls).toBe(21);
    });
  });

  /**
   * Unreachable search service.
   *
   * A transient DNS failure (EAI_AGAIN) once produced a DRAFT with zero
   * sources that sat in the version list looking like a researched report.
   * `search` returning [] on error made "found nothing" and "could not
   * connect" indistinguishable; these pin the difference.
   */
  describe('generateReport — search unavailable', () => {
    async function runWithSearchFailures(failed: boolean) {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'Basic Todo App',
        description: '',
        techStack: [],
        originDump: null,
      });
      mocks.ai.searchWithStatus.mockResolvedValue({ results: [], failed });
      mocks.ai.generateStructuredData.mockImplementation((_p, _sc, schemaName: string) => {
        if (schemaName === 'ProductShortlist') return Promise.resolve({ products: [] });
        if (schemaName === 'EntailmentBatch') return Promise.resolve({ judgements: [] });
        return Promise.resolve(validSections({ gapsAndOpportunities: [], comparableProducts: [] }));
      });
      const service = await build(mocks);
      await service.generateReport(REPORT_ID, PROJECT_ID);
      return mocks;
    }

    it('fails the report when every search is unreachable', async () => {
      const mocks = await runWithSearchFailures(true);

      const saved = savedData(mocks);
      expect(saved.status).toBe(ResearchReportStatus.FAILED);
    });

    // No point paying for generation with no evidence to generate from.
    it('does not call the model when no search succeeded', async () => {
      const mocks = await runWithSearchFailures(true);

      const reportCalls = (mocks.ai.generateStructuredData.mock.calls as [string, unknown, string][]).filter(
        (call) => call[2] === 'ResearchReport',
      );
      expect(reportCalls).toHaveLength(0);
    });

    it('explains the failure so the user can retry rather than guess', async () => {
      const mocks = await runWithSearchFailures(true);

      const saved = savedData(mocks);
      expect(saved.error).toContain('web search');
      expect(saved.error).toContain('try again');
    });

    it('emits a pipeline failure event', async () => {
      const mocks = await runWithSearchFailures(true);

      const stages = (mocks.pipeline.emit.mock.calls as [string, PipelineStage][]).map((call) => call[1]);
      expect(stages).toContain(PipelineStage.DISCOVERY_REPORT_FAILED);
    });

    // The contrast case: the service answered, there was simply nothing to
    // find. That is a legitimate (if thin) report, not a failure.
    it('still writes a report when search succeeds but finds nothing', async () => {
      const mocks = await runWithSearchFailures(false);

      const saved = savedData(mocks);
      expect(saved.status).toBe(ResearchReportStatus.DRAFT);
    });
  });

  describe('generateReport — failure handling', () => {
    it('marks the report FAILED and emits a pipeline event when the model fails', async () => {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'X',
        description: '',
        techStack: [],
        originDump: null,
      });
      mocks.ai.generateStructuredData.mockRejectedValue(new Error('schema validation failed'));
      const service = await build(mocks);

      // Must not throw: a queue job that rejects would retry the paid calls.
      await expect(service.generateReport(REPORT_ID, PROJECT_ID)).resolves.toBeUndefined();

      const saved = savedData(mocks);
      expect(saved.status).toBe(ResearchReportStatus.FAILED);
      expect(saved.error).toContain('schema validation failed');
      expect(mocks.pipeline.emit).toHaveBeenCalledWith(
        PROJECT_ID,
        PipelineStage.DISCOVERY_REPORT_FAILED,
        expect.any(String),
      );
    });

    it('fails cleanly when the project was deleted mid-flight', async () => {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue(null);
      const service = await build(mocks);

      await service.generateReport(REPORT_ID, PROJECT_ID);

      const saved = savedData(mocks);
      expect(saved.status).toBe(ResearchReportStatus.FAILED);
      expect(mocks.ai.generateStructuredData).not.toHaveBeenCalled();
    });

    // No Tavily key, or a provider outage, should still produce a report built
    // on analysis rather than failing outright.
    it('still generates a report when search returns nothing', async () => {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'X',
        description: '',
        techStack: [],
        originDump: null,
      });
      // Reached the service, genuinely no hits — distinct from unreachable.
      mocks.ai.searchWithStatus.mockResolvedValue({ results: [], failed: false });
      mocks.ai.generateStructuredData.mockResolvedValue(
        validSections({ gapsAndOpportunities: [], comparableProducts: [] }),
      );
      const service = await build(mocks);

      await service.generateReport(REPORT_ID, PROJECT_ID);

      const saved = savedData(mocks);
      expect(saved.status).toBe(ResearchReportStatus.DRAFT);
      expect(saved.sources).toEqual([]);
    });
  });

  describe('approveReport', () => {
    it('enforces membership', async () => {
      const mocks = buildMocks();
      mocks.access.assertMember.mockRejectedValue(new NotFoundException());
      const service = await build(mocks);

      await expect(service.approveReport(USER_ID, PROJECT_ID, 1)).rejects.toThrow(NotFoundException);
    });

    it('404s for a version that does not exist', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findUnique.mockResolvedValue(null);
      const service = await build(mocks);

      await expect(service.approveReport(USER_ID, PROJECT_ID, 9)).rejects.toThrow(NotFoundException);
    });

    it('refuses to approve a pending report', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findUnique.mockResolvedValue({
        id: REPORT_ID,
        status: ResearchReportStatus.PENDING,
      });
      const service = await build(mocks);

      await expect(service.approveReport(USER_ID, PROJECT_ID, 1)).rejects.toThrow(ConflictException);
    });

    it('refuses to approve a failed report', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findUnique.mockResolvedValue({
        id: REPORT_ID,
        status: ResearchReportStatus.FAILED,
      });
      const service = await build(mocks);

      await expect(service.approveReport(USER_ID, PROJECT_ID, 1)).rejects.toThrow(ConflictException);
    });

    it('demotes a previous approval in the same transaction', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findUnique.mockResolvedValue({
        id: REPORT_ID,
        status: ResearchReportStatus.DRAFT,
      });
      mocks.prisma.$transaction.mockResolvedValue([
        { count: 1 },
        { id: REPORT_ID, version: 2, status: ResearchReportStatus.APPROVED },
      ]);
      const service = await build(mocks);

      const result = await service.approveReport(USER_ID, PROJECT_ID, 2);

      expect(mocks.prisma.$transaction).toHaveBeenCalled();
      expect(result.status).toBe(ResearchReportStatus.APPROVED);
    });
  });

  describe('rejectReport', () => {
    async function setup(status: ResearchReportStatus) {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findUnique.mockResolvedValue({
        id: REPORT_ID,
        version: 4,
        status,
      });
      // The shared `update` mock is declared returning `unknown`, which narrows
      // mockResolvedValue's parameter to `never`; resolve through the untyped
      // implementation instead of widening the mock for every other test.
      mocks.prisma.researchReport.update.mockImplementation(() =>
        Promise.resolve({ id: REPORT_ID, version: 4, status: ResearchReportStatus.REJECTED }),
      );
      return { mocks, service: await build(mocks) };
    }

    it('enforces membership', async () => {
      const mocks = buildMocks();
      mocks.access.assertMember.mockRejectedValue(new NotFoundException());
      const service = await build(mocks);

      await expect(service.rejectReport(USER_ID, PROJECT_ID, 4)).rejects.toThrow(NotFoundException);
      expect(mocks.prisma.researchReport.update).not.toHaveBeenCalled();
    });

    it('404s for a version that does not exist', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findUnique.mockResolvedValue(null);
      const service = await build(mocks);

      await expect(service.rejectReport(USER_ID, PROJECT_ID, 99)).rejects.toThrow(NotFoundException);
    });

    // Nothing to judge yet.
    it('refuses to reject a pending report', async () => {
      const { service } = await setup(ResearchReportStatus.PENDING);
      await expect(service.rejectReport(USER_ID, PROJECT_ID, 4)).rejects.toThrow(ConflictException);
    });

    it('refuses to reject a failed report', async () => {
      const { service } = await setup(ResearchReportStatus.FAILED);
      await expect(service.rejectReport(USER_ID, PROJECT_ID, 4)).rejects.toThrow(ConflictException);
    });

    it('rejects a draft and stores the reason', async () => {
      const { mocks, service } = await setup(ResearchReportStatus.DRAFT);

      await service.rejectReport(USER_ID, PROJECT_ID, 4, '  citations do not hold up  ');

      const data = mocks.prisma.researchReport.update.mock.calls[0][0].data as unknown as {
        status: ResearchReportStatus;
        rejectionReason: string | null;
      };
      expect(data.status).toBe(ResearchReportStatus.REJECTED);
      // Trimmed, so stray whitespace does not reach the next prompt.
      expect(data.rejectionReason).toBe('citations do not hold up');
    });

    it('allows rejecting without a reason', async () => {
      const { mocks, service } = await setup(ResearchReportStatus.DRAFT);

      await service.rejectReport(USER_ID, PROJECT_ID, 4);

      const data = mocks.prisma.researchReport.update.mock.calls[0][0].data as unknown as {
        rejectionReason: string | null;
      };
      expect(data.rejectionReason).toBeNull();
    });

    // A whitespace-only reason is the same as none; storing it would put an
    // empty feedback block into the next prompt.
    it('treats a blank reason as no reason', async () => {
      const { mocks, service } = await setup(ResearchReportStatus.DRAFT);

      await service.rejectReport(USER_ID, PROJECT_ID, 4, '   ');

      const data = mocks.prisma.researchReport.update.mock.calls[0][0].data as unknown as {
        rejectionReason: string | null;
      };
      expect(data.rejectionReason).toBeNull();
    });

    it('caps a long reason, since it reaches a prompt', async () => {
      const { mocks, service } = await setup(ResearchReportStatus.DRAFT);

      await service.rejectReport(USER_ID, PROJECT_ID, 4, 'x'.repeat(5000));

      const data = mocks.prisma.researchReport.update.mock.calls[0][0].data as unknown as {
        rejectionReason: string;
      };
      expect(data.rejectionReason).toHaveLength(1000);
    });

    // A user may reconsider on a closer read.
    it('allows rejecting a previously approved version', async () => {
      const { service } = await setup(ResearchReportStatus.APPROVED);
      await expect(service.rejectReport(USER_ID, PROJECT_ID, 4)).resolves.toBeDefined();
    });
  });

  /**
   * Cancelling a running report.
   *
   * The hard part is not the status change but the race: an in-flight provider
   * call cannot be recalled, so a job that finishes after the cancel must
   * discard its result rather than resurrect the row as a DRAFT.
   */
  describe('cancelReport', () => {
    async function setupCancel(status: ResearchReportStatus, queuedJobs: unknown[] = []) {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findUnique.mockResolvedValue({ id: REPORT_ID, version: 5, status });
      mocks.prisma.researchReport.update.mockImplementation(() =>
        Promise.resolve({ id: REPORT_ID, version: 5, status: ResearchReportStatus.CANCELLED }),
      );
      mocks.queue.getJobs.mockResolvedValue(queuedJobs);
      return { mocks, service: await build(mocks) };
    }

    it('enforces membership', async () => {
      const mocks = buildMocks();
      mocks.access.assertMember.mockRejectedValue(new NotFoundException());
      const service = await build(mocks);

      await expect(service.cancelReport(USER_ID, PROJECT_ID, 5)).rejects.toThrow(NotFoundException);
      expect(mocks.prisma.researchReport.update).not.toHaveBeenCalled();
    });

    it('404s for a version that does not exist', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findUnique.mockResolvedValue(null);
      const service = await build(mocks);

      await expect(service.cancelReport(USER_ID, PROJECT_ID, 99)).rejects.toThrow(NotFoundException);
    });

    it('marks a pending report CANCELLED', async () => {
      const { mocks, service } = await setupCancel(ResearchReportStatus.PENDING);

      await service.cancelReport(USER_ID, PROJECT_ID, 5);

      const data = mocks.prisma.researchReport.update.mock.calls[0][0].data as unknown as {
        status: ResearchReportStatus;
      };
      expect(data.status).toBe(ResearchReportStatus.CANCELLED);
    });

    // Cancelling a finished report would throw away a usable result.
    it('refuses to cancel a report that already finished', async () => {
      const { service } = await setupCancel(ResearchReportStatus.DRAFT);
      await expect(service.cancelReport(USER_ID, PROJECT_ID, 5)).rejects.toThrow(ConflictException);
    });

    it('refuses to cancel an approved report', async () => {
      const { service } = await setupCancel(ResearchReportStatus.APPROVED);
      await expect(service.cancelReport(USER_ID, PROJECT_ID, 5)).rejects.toThrow(ConflictException);
    });

    // A job still waiting costs nothing to remove, so it should be removed.
    it('removes the queued job when it has not started', async () => {
      const remove = jest.fn().mockResolvedValue(undefined);
      const { service } = await setupCancel(ResearchReportStatus.PENDING, [
        { data: { reportId: REPORT_ID }, remove },
        { data: { reportId: 'someone-elses-report' }, remove: jest.fn() },
      ]);

      await service.cancelReport(USER_ID, PROJECT_ID, 5);

      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("leaves other projects' queued jobs alone", async () => {
      const otherRemove = jest.fn();
      const { service } = await setupCancel(ResearchReportStatus.PENDING, [
        { data: { reportId: 'someone-elses-report' }, remove: otherRemove },
      ]);

      await service.cancelReport(USER_ID, PROJECT_ID, 5);

      expect(otherRemove).not.toHaveBeenCalled();
    });

    // The queue is best-effort: the status change is what actually matters.
    it('still cancels when the queue cannot be inspected', async () => {
      const { mocks, service } = await setupCancel(ResearchReportStatus.PENDING);
      mocks.queue.getJobs.mockRejectedValue(new Error('redis unavailable'));

      await expect(service.cancelReport(USER_ID, PROJECT_ID, 5)).resolves.toBeDefined();
      expect(mocks.prisma.researchReport.update).toHaveBeenCalled();
    });
  });

  /**
   * The cancel race: generation already running when the user cancels.
   */
  describe('generateReport — honours a cancel mid-flight', () => {
    async function runCancelledMidFlight(statusAtWrite: ResearchReportStatus, shouldFail = false) {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'Basic Todo App',
        description: '',
        techStack: [],
        originDump: null,
      });
      mocks.ai.searchWithStatus.mockResolvedValue({
        results: [{ title: 'R', url: 'https://example.com/a', content: 'body', score: 1 }],
        failed: false,
      });
      // The status read just before the write (and in failReport).
      mocks.prisma.researchReport.findUnique.mockResolvedValue({ status: statusAtWrite });
      mocks.ai.generateStructuredData.mockImplementation((_p, _sc, schemaName: string) => {
        if (schemaName === 'ProductShortlist') return Promise.resolve({ products: [] });
        if (schemaName === 'EntailmentBatch') return Promise.resolve({ judgements: [] });
        if (shouldFail) return Promise.reject(new Error('provider exploded'));
        return Promise.resolve(validSections());
      });
      const service = await build(mocks);
      await service.generateReport(REPORT_ID, PROJECT_ID);
      return mocks;
    }

    // The point of the whole feature: a cancelled report must not come back.
    it('discards the result instead of writing a DRAFT', async () => {
      const mocks = await runCancelledMidFlight(ResearchReportStatus.CANCELLED);

      expect(mocks.prisma.researchReport.update).not.toHaveBeenCalled();
    });

    it('does not rewrite a cancelled report as FAILED', async () => {
      const mocks = await runCancelledMidFlight(ResearchReportStatus.CANCELLED, true);

      expect(mocks.prisma.researchReport.update).not.toHaveBeenCalled();
    });

    it('writes normally when the report was not cancelled', async () => {
      const mocks = await runCancelledMidFlight(ResearchReportStatus.PENDING);

      const saved = savedData(mocks);
      expect(saved.status).toBe(ResearchReportStatus.DRAFT);
    });
  });

  describe('rejection feedback reaches the next generation', () => {
    async function generateAfterRejection(rejectionReason: string | null) {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'Uni LMS',
        description: 'An LMS',
        techStack: ['NestJS'],
        originDump: { rawTranscript: 'dump' },
      });
      mocks.ai.searchWithStatus.mockResolvedValue({
        results: [{ title: 'R', url: 'https://moodle.org/about', content: 'body', score: 1 }],
        failed: false,
      });
      // latestRejectionFeedback() reads the most recent REJECTED row.
      mocks.prisma.researchReport.findFirst.mockResolvedValue(rejectionReason ? { version: 3, rejectionReason } : null);
      mocks.ai.generateStructuredData.mockImplementation((_p, _sc, schemaName: string) => {
        if (schemaName === 'EntailmentBatch') {
          return Promise.resolve({ judgements: [] });
        }
        if (schemaName === 'ProductShortlist') {
          return Promise.resolve({ products: [] });
        }
        return Promise.resolve(validSections());
      });
      const service = await build(mocks);
      await service.generateReport(REPORT_ID, PROJECT_ID);

      // Matched on the schema name rather than "the first non-entailment call":
      // generation now also makes a ProductShortlist call, which came first and
      // silently made this assertion read the wrong prompt.
      const calls = mocks.ai.generateStructuredData.mock.calls as [string, unknown, string][];
      const reportCall = calls.find((call) => call[2] === 'ResearchReport');
      return reportCall?.[0];
    }

    it('includes the previous rejection reason in the prompt', async () => {
      const prompt = await generateAfterRejection('scope was far too large');

      expect(prompt).toContain('REJECTED YOUR PREVIOUS ATTEMPT');
      expect(prompt).toContain('scope was far too large');
    });

    it('omits the feedback block entirely when nothing was rejected', async () => {
      const prompt = await generateAfterRejection(null);

      expect(prompt).not.toContain('REJECTED YOUR PREVIOUS ATTEMPT');
    });

    // The feedback must not become a way to talk the model out of the idea,
    // which is the product's core rule.
    it('still forbids rejecting the idea when feedback is present', async () => {
      const prompt = await generateAfterRejection('this idea seems pointless, tell me to stop');

      expect(prompt).toContain('never a reason to recommend against building');
    });
  });

  describe('read paths enforce membership', () => {
    it.each([
      ['getLatestReport', (s: ResearchService) => s.getLatestReport(USER_ID, PROJECT_ID)],
      ['listReportVersions', (s: ResearchService) => s.listReportVersions(USER_ID, PROJECT_ID)],
      ['getReportVersion', (s: ResearchService) => s.getReportVersion(USER_ID, PROJECT_ID, 1)],
    ])('%s rejects a non-member', async (_name, call) => {
      const mocks = buildMocks();
      mocks.access.assertMember.mockRejectedValue(new NotFoundException());
      const service = await build(mocks);

      await expect(call(service)).rejects.toThrow(NotFoundException);
    });
  });
});
