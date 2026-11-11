import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ResearchReportStatus, TaskStatus } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { RoadmapService } from '../roadmap.service';

/**
 * Roadmap generation.
 *
 * The regeneration rules matter most. An early version only unlinked old tasks
 * before creating new ones, so regenerating duplicated every task — found by
 * running generate three times against the dev database and watching the count
 * climb. The fix deletes untouched generated tasks and keeps anything carrying
 * progress, which is a narrow distinction worth pinning down.
 */
describe('RoadmapService — generation', () => {
  const USER_ID = 'user-1';
  const PROJECT_ID = '11111111-1111-1111-1111-111111111111';

  /** Typed so assertions read the recorded arguments without `any`. */
  type WhereArg = { where: Prisma.TaskWhereInput };
  type UpdateArg = { where: Prisma.TaskWhereInput; data: { milestoneId: null } };
  type CreateManyArg = { data: { priority: string; effort: string; title: string }[] };

  function buildMocks() {
    const tx = {
      task: {
        deleteMany: jest.fn() as jest.Mock<unknown, [WhereArg]>,
        updateMany: jest.fn() as jest.Mock<unknown, [UpdateArg]>,
        createMany: jest.fn() as jest.Mock<unknown, [CreateManyArg]>,
      },
      milestone: { create: jest.fn(), deleteMany: jest.fn() },
      project: { update: jest.fn() },
    };

    return {
      tx,
      prisma: {
        project: { findUnique: jest.fn() },
        researchReport: { findFirst: jest.fn() },
        task: { findMany: jest.fn() },
        milestone: { findFirst: jest.fn() },
        $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
      },
      access: { assertMember: jest.fn().mockResolvedValue({}) },
    };
  }

  async function build(mocks: ReturnType<typeof buildMocks>): Promise<RoadmapService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapService,
        { provide: PrismaService, useValue: mocks.prisma },
        { provide: ProjectAccessService, useValue: mocks.access },
      ],
    }).compile();

    return module.get(RoadmapService);
  }

  const scope = [{ title: 'Core thing', priority: 'MUST_HAVE' as const, effort: 'MEDIUM' as const, fromReport: true }];

  function readyProject(mocks: ReturnType<typeof buildMocks>) {
    mocks.prisma.project.findUnique.mockResolvedValue({
      id: PROJECT_ID,
      deadline: new Date('2026-12-31T00:00:00Z'),
      hoursPerDay: 2,
      workingDays: [1, 2, 3, 4, 5],
      skillLevel: 'INTERMEDIATE',
    });
    mocks.tx.milestone.create.mockResolvedValue({
      id: 'm1',
      title: 'Core MVP',
      position: 1,
      targetDate: new Date('2026-11-20T00:00:00Z'),
    });
  }

  describe('suggestScope', () => {
    it('enforces membership', async () => {
      const mocks = buildMocks();
      mocks.access.assertMember.mockRejectedValue(new NotFoundException());
      const service = await build(mocks);

      await expect(service.suggestScope(USER_ID, PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    // Building a roadmap on unreviewed AI output is the criticism the report's
    // own beta marking invites; approval is what makes it the user's scope.
    it('reads only an approved report', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findFirst.mockResolvedValue(null);
      const service = await build(mocks);

      await service.suggestScope(USER_ID, PROJECT_ID);

      const calls = mocks.prisma.researchReport.findFirst.mock.calls as [{ where: { status: ResearchReportStatus } }][];
      expect(calls[0]?.[0].where.status).toBe(ResearchReportStatus.APPROVED);
    });

    it('returns empty scope rather than throwing when no report is approved', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findFirst.mockResolvedValue(null);
      const service = await build(mocks);

      const result = await service.suggestScope(USER_ID, PROJECT_ID);

      expect(result).toEqual({ fromReportVersion: null, scope: [] });
    });

    it('maps an approved report to editable scope', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findFirst.mockResolvedValue({
        version: 13,
        sections: { mvpScope: { mustHave: ['Add task'], shouldHave: ['Dark mode'], later: ['Sync'] } },
      });
      const service = await build(mocks);

      const result = await service.suggestScope(USER_ID, PROJECT_ID);

      expect(result.fromReportVersion).toBe(13);
      expect(result.scope).toHaveLength(3);
      expect(result.scope.every((s) => s.fromReport)).toBe(true);
    });

    it('tolerates an approved report with no mvpScope', async () => {
      const mocks = buildMocks();
      mocks.prisma.researchReport.findFirst.mockResolvedValue({ version: 2, sections: {} });
      const service = await build(mocks);

      expect((await service.suggestScope(USER_ID, PROJECT_ID)).scope).toEqual([]);
    });
  });

  describe('generateRoadmap', () => {
    it('enforces membership before writing anything', async () => {
      const mocks = buildMocks();
      mocks.access.assertMember.mockRejectedValue(new NotFoundException());
      const service = await build(mocks);

      await expect(service.generateRoadmap(USER_ID, PROJECT_ID, scope)).rejects.toThrow(NotFoundException);
      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses empty scope', async () => {
      const service = await build(buildMocks());

      await expect(service.generateRoadmap(USER_ID, PROJECT_ID, [])).rejects.toThrow(BadRequestException);
    });

    it('404s for a missing project', async () => {
      const mocks = buildMocks();
      mocks.prisma.project.findUnique.mockResolvedValue(null);
      const service = await build(mocks);

      await expect(service.generateRoadmap(USER_ID, PROJECT_ID, scope)).rejects.toThrow(NotFoundException);
    });

    // The regression. Regenerating must not leave a second copy of every task.
    it('deletes untouched generated tasks before rebuilding', async () => {
      const mocks = buildMocks();
      readyProject(mocks);
      const service = await build(mocks);

      await service.generateRoadmap(USER_ID, PROJECT_ID, scope);

      expect(mocks.tx.task.deleteMany).toHaveBeenCalled();
      const where = mocks.tx.task.deleteMany.mock.calls[0][0].where;
      expect(where.projectId).toBe(PROJECT_ID);
      expect(where.status).toBe(TaskStatus.TODO);
    });

    // Every one of these conditions protects a different progress signal.
    it('only deletes tasks carrying no progress at all', async () => {
      const mocks = buildMocks();
      readyProject(mocks);
      const service = await build(mocks);

      await service.generateRoadmap(USER_ID, PROJECT_ID, scope);

      const where = mocks.tx.task.deleteMany.mock.calls[0][0].where;
      expect(where.status).toBe(TaskStatus.TODO);
      expect(where.completedAt).toBeNull();
      expect(where.dailyPlanId).toBeNull();
      expect(where.plannedFor).toBeNull();
      expect(where.assigneeId).toBeNull();
      expect(where.comments).toEqual({ none: {} });
      // Never touches backlog tasks the user created or the pipeline generated.
      expect(where.milestoneId).toEqual({ not: null });
    });

    // Verified live: a DONE task survived a regeneration with unrelated scope.
    it('unlinks surviving work rather than deleting it', async () => {
      const mocks = buildMocks();
      readyProject(mocks);
      const service = await build(mocks);

      await service.generateRoadmap(USER_ID, PROJECT_ID, scope);

      const update = mocks.tx.task.updateMany.mock.calls[0][0];
      expect(update.data.milestoneId).toBeNull();
      expect(update.where.milestoneId).toEqual({ not: null });
    });

    it('creates a milestone per populated band and stamps roadmapPlannedAt', async () => {
      const mocks = buildMocks();
      readyProject(mocks);
      const service = await build(mocks);

      const result = await service.generateRoadmap(USER_ID, PROJECT_ID, scope);

      expect(mocks.tx.milestone.create).toHaveBeenCalledTimes(1);
      expect(mocks.tx.project.update).toHaveBeenCalled();
      expect(result.milestones).toHaveLength(1);
    });

    it('carries priority and effort onto created tasks', async () => {
      const mocks = buildMocks();
      readyProject(mocks);
      const service = await build(mocks);

      await service.generateRoadmap(USER_ID, PROJECT_ID, scope);

      const created = mocks.tx.task.createMany.mock.calls[0][0].data;
      expect(created[0]).toMatchObject({ priority: 'MUST_HAVE', effort: 'MEDIUM' });
    });

    // One transaction, so a failure part-way cannot leave a half-built roadmap.
    it('does all of it in one transaction', async () => {
      const mocks = buildMocks();
      readyProject(mocks);
      const service = await build(mocks);

      await service.generateRoadmap(USER_ID, PROJECT_ID, scope);

      expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
