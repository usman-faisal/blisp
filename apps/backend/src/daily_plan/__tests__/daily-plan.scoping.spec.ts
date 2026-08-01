import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectStatus, TaskStatus } from '@repo/db';
import { AiService } from 'src/ai/ai.service';
import { QUEUES } from 'src/common/lib/constants';
import { PrismaService } from 'src/common/services/prisma.service';
import { PipelineEventsService } from 'src/pipeline_events/pipeline-events.service';
import { DailyPlanCronService } from '../daily-plan.service';

/**
 * Phase 4: which tasks land in a member's daily plan on a shared project.
 *
 * The trap this guards: widening the query to project membership alone would
 * give all three members an identical plan containing each other's tasks.
 */
describe('DailyPlanCronService — shared project scoping', () => {
  let service: DailyPlanCronService;

  const mockPrisma = {
    dailyPlan: { findUnique: jest.fn(), create: jest.fn() },
    task: { updateMany: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const USER = 'user_alice';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.dailyPlan.findUnique.mockResolvedValue(null);
    mockPrisma.task.updateMany.mockResolvedValue({ count: 0 });
    // No backlog: the run stops after the queries under test.
    mockPrisma.task.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPlanCronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: { generateText: jest.fn() } },
        { provide: PipelineEventsService, useValue: { emit: jest.fn() } },
        { provide: getQueueToken(QUEUES.INCUBATOR), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<DailyPlanCronService>(DailyPlanCronService);
  });

  it('scopes the backlog to projects the user is a member of', async () => {
    await service.processUserPlan(USER);

    const where = mockPrisma.task.findMany.mock.calls[0][0].where;

    expect(where.project).toMatchObject({
      status: ProjectStatus.ACTIVE,
      members: { some: { userId: USER } },
    });
  });

  // The core of it: a member's plan contains their own work, not the team's.
  it('takes tasks assigned to the user, or unclaimed ones on their own project', async () => {
    await service.processUserPlan(USER);

    const where = mockPrisma.task.findMany.mock.calls[0][0].where;

    expect(where.OR).toEqual([
      { assigneeId: USER },
      { assigneeId: null, project: { userId: USER } },
    ]);
  });

  it('does not pull tasks assigned to a teammate', async () => {
    await service.processUserPlan(USER);

    const where = mockPrisma.task.findMany.mock.calls[0][0].where;
    const takesAnyAssignee = where.OR.some(
      (clause: any) => clause.assigneeId !== USER && clause.assigneeId !== null,
    );

    expect(takesAnyAssignee).toBe(false);
  });

  it('applies the same scope when rolling over yesterday\'s tasks', async () => {
    await service.processUserPlan(USER);

    const where = mockPrisma.task.updateMany.mock.calls[0][0].where;

    expect(where.status).toBe(TaskStatus.TODO);
    expect(where.OR).toEqual([
      { assigneeId: USER },
      { assigneeId: null, project: { userId: USER } },
    ]);
  });

  it('skips a user who already has a plan for today', async () => {
    mockPrisma.dailyPlan.findUnique.mockResolvedValue({ id: 'plan-1' });

    await service.processUserPlan(USER);

    expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
  });
});
