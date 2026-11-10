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
        generateStructuredData: jest.fn(),
        modelId: 'test-model',
      },
      access: { assertMember: jest.fn().mockResolvedValue({}) },
      pipeline: { emit: jest.fn().mockResolvedValue(undefined) },
      queue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
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
    /** Wires a successful generation returning `sections` over `urls`. */
    async function runWith(sections: ResearchReportSections, urls: string[]) {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue({
        title: 'Uni LMS',
        description: 'An LMS',
        techStack: ['NestJS'],
        originDump: { rawTranscript: 'I want to build an LMS' },
      });
      mocks.ai.search.mockResolvedValue(urls.map((url, i) => ({ title: `R${i}`, url, content: 'body', score: 1 })));
      mocks.ai.generateStructuredData.mockResolvedValue(sections);
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
      mocks.ai.search.mockResolvedValue([{ title: 'Dup', url: 'https://same.example.com', content: 'b', score: 1 }]);
      mocks.ai.generateStructuredData.mockResolvedValue(
        validSections({ gapsAndOpportunities: [], comparableProducts: [] }),
      );
      const service = await build(mocks);

      await service.generateReport(REPORT_ID, PROJECT_ID);

      const saved = savedData(mocks);
      expect(mocks.ai.search).toHaveBeenCalledTimes(4);
      expect(saved.sources).toHaveLength(1);
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
      mocks.ai.search.mockResolvedValue([]);
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
