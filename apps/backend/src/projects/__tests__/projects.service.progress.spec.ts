import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectRole, TaskStatus } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { DailyPlanCronService } from 'src/daily_plan/daily-plan.service';
import { ProjectAccessService } from '../project-access.service';
import { ProjectsService } from '../projects.service';

/** Phase 4: overall and per-member progress. */
describe('ProjectsService — progress', () => {
  let service: ProjectsService;

  const mockPrisma = {
    project: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
    task: { groupBy: jest.fn() },
    projectMember: { findMany: jest.fn() },
  };

  const mockAccess = {
    assertMember: jest.fn(),
    assertOwner: jest.fn(),
    memberProjectIds: jest.fn(),
    isMember: jest.fn(),
  };

  const ALICE = 'user_alice';
  const BOB = 'user_bob';
  const PROJECT = 'project-1';

  const members = [
    { userId: ALICE, role: ProjectRole.OWNER, user: { name: 'Alice' } },
    { userId: BOB, role: ProjectRole.MEMBER, user: { name: 'Bob' } },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectAccessService, useValue: mockAccess },
        { provide: DailyPlanCronService, useValue: { processUserPlan: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('reports overall totals and completion percentage', async () => {
    mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });
    mockPrisma.task.groupBy
      .mockResolvedValueOnce([
        { status: TaskStatus.DONE, _count: { id: 3 } },
        { status: TaskStatus.IN_PROGRESS, _count: { id: 1 } },
        { status: TaskStatus.TODO, _count: { id: 6 } },
      ])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(members);

    const result = await service.getProjectProgress(ALICE, PROJECT);

    expect(result.data.overall).toEqual({
      total: 10,
      done: 3,
      inProgress: 1,
      todo: 6,
      percentComplete: 30,
    });
  });

  it('breaks progress down per member', async () => {
    mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });
    mockPrisma.task.groupBy
      .mockResolvedValueOnce([
        { status: TaskStatus.DONE, _count: { id: 2 } },
        { status: TaskStatus.TODO, _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([
        { assigneeId: ALICE, status: TaskStatus.DONE, _count: { id: 2 } },
        { assigneeId: BOB, status: TaskStatus.TODO, _count: { id: 1 } },
        { assigneeId: null, status: TaskStatus.TODO, _count: { id: 2 } },
      ]);
    mockPrisma.projectMember.findMany.mockResolvedValue(members);

    const result = await service.getProjectProgress(ALICE, PROJECT);

    const alice = result.data.perMember.find((m) => m.userId === ALICE);
    const bob = result.data.perMember.find((m) => m.userId === BOB);

    expect(alice).toMatchObject({ name: 'Alice', assigned: 2, done: 2, todo: 0 });
    expect(bob).toMatchObject({ name: 'Bob', assigned: 1, done: 0, todo: 1 });
    // Unclaimed work is the team's shared backlog, not anyone's column.
    expect(result.data.unassigned).toBe(2);
  });

  it('includes a member with no assigned tasks as zeroes', async () => {
    mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });
    mockPrisma.task.groupBy
      .mockResolvedValueOnce([{ status: TaskStatus.DONE, _count: { id: 1 } }])
      .mockResolvedValueOnce([{ assigneeId: ALICE, status: TaskStatus.DONE, _count: { id: 1 } }]);
    mockPrisma.projectMember.findMany.mockResolvedValue(members);

    const result = await service.getProjectProgress(ALICE, PROJECT);

    expect(result.data.perMember.find((m) => m.userId === BOB)).toMatchObject({
      assigned: 0,
      done: 0,
    });
  });

  // Guard the divide — an empty project is 0%, not NaN.
  it('reports 0% for a project with no tasks', async () => {
    mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });
    mockPrisma.task.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(members);

    const result = await service.getProjectProgress(ALICE, PROJECT);

    expect(result.data.overall.percentComplete).toBe(0);
    expect(result.data.overall.total).toBe(0);
  });

  it('rejects a non-member', async () => {
    mockAccess.assertMember.mockRejectedValue(new NotFoundException());

    await expect(service.getProjectProgress('user_stranger', PROJECT)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.task.groupBy).not.toHaveBeenCalled();
  });

  // Aggregate in the database: this runs on every roadmap view.
  it('aggregates via groupBy rather than loading tasks', async () => {
    mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });
    mockPrisma.task.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(members);

    await service.getProjectProgress(ALICE, PROJECT);

    expect(mockPrisma.task.groupBy).toHaveBeenCalledTimes(2);
  });
});
