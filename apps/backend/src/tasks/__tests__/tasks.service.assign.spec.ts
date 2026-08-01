import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { TasksService } from '../tasks.service';

/** Phase 4: task assignment. */
describe('TasksService — assignment', () => {
  let service: TasksService;

  const mockPrisma = {
    task: { findUnique: jest.fn(), update: jest.fn() },
    projectMember: { findUnique: jest.fn() },
  };

  const mockAccess = {
    assertMember: jest.fn(),
    assertOwner: jest.fn(),
    isMember: jest.fn(),
    memberProjectIds: jest.fn(),
  };

  const ACTOR = 'user_alice';
  const TEAMMATE = 'user_bob';
  const OUTSIDER = 'user_carol';
  const TASK = 'task-1';
  const PROJECT = 'project-1';

  const task = { id: TASK, title: 'Wire up auth', projectId: PROJECT };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectAccessService, useValue: mockAccess },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('assigns a task to a fellow member and snapshots their name', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(task);
    mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
    mockPrisma.projectMember.findUnique.mockResolvedValue({
      userId: TEAMMATE,
      user: { name: 'Bob' },
    });
    mockPrisma.task.update.mockResolvedValue({
      id: TASK,
      title: task.title,
      assigneeId: TEAMMATE,
      assigneeName: 'Bob',
    });

    const result = await service.assignTask(ACTOR, TASK, { assigneeId: TEAMMATE });

    expect(result.data.assigneeName).toBe('Bob');
    expect(mockPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assigneeId: TEAMMATE, assigneeName: 'Bob' },
      }),
    );
  });

  // The check that matters: without it a task could be assigned to any user id,
  // including someone with no access to the project.
  it('refuses to assign to a non-member', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(task);
    mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    await expect(
      service.assignTask(ACTOR, TASK, { assigneeId: OUTSIDER }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.task.update).not.toHaveBeenCalled();
  });

  it('unassigns when assigneeId is null', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(task);
    mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
    mockPrisma.task.update.mockResolvedValue({
      id: TASK,
      title: task.title,
      assigneeId: null,
      assigneeName: null,
    });

    const result = await service.assignTask(ACTOR, TASK, { assigneeId: null });

    expect(result.data.assigneeId).toBeNull();
    expect(result.message).toMatch(/unassigned/);
    // No membership lookup needed to clear an assignment.
    expect(mockPrisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('treats an omitted assigneeId as an unassign', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(task);
    mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
    mockPrisma.task.update.mockResolvedValue({
      id: TASK,
      title: task.title,
      assigneeId: null,
      assigneeName: null,
    });

    const result = await service.assignTask(ACTOR, TASK, {});

    expect(result.data.assigneeId).toBeNull();
  });

  it('rejects a non-member of the task\'s project', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(task);
    mockAccess.assertMember.mockRejectedValue(new NotFoundException());

    await expect(
      service.assignTask('user_stranger', TASK, { assigneeId: TEAMMATE }),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrisma.task.update).not.toHaveBeenCalled();
  });

  it('throws NotFound for a missing task', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);

    await expect(
      service.assignTask(ACTOR, 'missing', { assigneeId: TEAMMATE }),
    ).rejects.toThrow(NotFoundException);

    expect(mockAccess.assertMember).not.toHaveBeenCalled();
  });
});
