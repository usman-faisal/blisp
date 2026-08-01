import { Test, TestingModule } from '@nestjs/testing';
import { ProjectRole, TaskStatus } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { DailyPlanCronService } from 'src/daily_plan/daily-plan.service';
import { ProjectAccessService } from '../project-access.service';
import { ProjectsService } from '../projects.service';

/**
 * Phase 7 slice 2: the roadmap carries each task's assignee.
 *
 * Without it the mobile roadmap would need a detail fetch per row just to show
 * who owns a task.
 */
describe('ProjectsService — detail assignee', () => {
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
  const PROJECT = 'project-1';

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

  it('returns each task with its assignee, and null for unclaimed ones', async () => {
    mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: PROJECT,
      title: 'Blisp',
      description: null,
      techStack: [],
      classification: 'PROJECT',
      status: 'ACTIVE',
      resources: [],
      tasks: [
        {
          id: 'task-1',
          title: 'Claimed task',
          status: TaskStatus.TODO,
          plannedFor: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          assigneeId: ALICE,
          assigneeName: 'Alice',
        },
        {
          id: 'task-2',
          title: 'Backlog task',
          status: TaskStatus.TODO,
          plannedFor: null,
          createdAt: new Date('2026-01-02T00:00:00Z'),
          assigneeId: null,
          assigneeName: null,
        },
      ],
    });

    const result = await service.getProjectById(ALICE, PROJECT);

    expect(result.data.tasks[0]).toMatchObject({
      id: 'task-1',
      assigneeId: ALICE,
      assigneeName: 'Alice',
    });
    expect(result.data.tasks[1]).toMatchObject({
      id: 'task-2',
      assigneeId: null,
      assigneeName: null,
    });
  });

  it('selects the assignee columns, so the payload is not silently empty', async () => {
    mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: PROJECT,
      title: 'Blisp',
      description: null,
      techStack: [],
      classification: 'PROJECT',
      status: 'ACTIVE',
      resources: [],
      tasks: [],
    });

    await service.getProjectById(ALICE, PROJECT);

    // A `select` that omits these would compile fine and return undefined at
    // runtime, so assert on the query rather than only on the mapped output.
    const args = mockPrisma.project.findUnique.mock.calls[0][0];
    expect(args.include.tasks.select).toMatchObject({
      assigneeId: true,
      assigneeName: true,
    });
  });

  it('denies a non-member before reading the project', async () => {
    mockAccess.assertMember.mockRejectedValue(new Error('not a member'));

    await expect(service.getProjectById('user_stranger', PROJECT)).rejects.toThrow();
    expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
  });
});
