import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TaskStatus } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { TasksService } from '../tasks.service';

/**
 * Phase 2 access-control contract for TasksService.
 *
 * Tasks previously authorised through the parent project's creator
 * (`where: { project: { userId } }`). They now resolve the task first and
 * authorise against its project's membership.
 */
describe('TasksService — membership access', () => {
  let service: TasksService;

  const mockPrisma = {
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAccess = {
    assertMember: jest.fn(),
    assertOwner: jest.fn(),
    isMember: jest.fn(),
    memberProjectIds: jest.fn(),
  };

  const MEMBER = 'user_member';
  const STRANGER = 'user_stranger';
  const TASK = 'task-1';
  const PROJECT = 'project-1';

  const task = {
    id: TASK,
    projectId: PROJECT,
    title: 'Wire up auth',
    status: TaskStatus.TODO,
    project: { id: PROJECT, title: 'Shared roadmap', techStack: ['ts'] },
    resources: [],
  };

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

  describe('getTaskById', () => {
    it('lets a member read a task on a shared project', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });

      const result = await service.getTaskById(MEMBER, TASK);

      expect(result.data.id).toBe(TASK);
      // Authorised against the task's parent project, not the task itself.
      expect(mockAccess.assertMember).toHaveBeenCalledWith(MEMBER, PROJECT);
    });

    it('no longer scopes the lookup through project.userId', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });

      await service.getTaskById(MEMBER, TASK);

      const where = mockPrisma.task.findUnique.mock.calls[0][0].where;
      expect(where).toEqual({ id: TASK });
      expect(where).not.toHaveProperty('project');
    });

    it('rejects a non-member', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockAccess.assertMember.mockRejectedValue(new NotFoundException());

      await expect(service.getTaskById(STRANGER, TASK)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound for a task that does not exist', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(service.getTaskById(MEMBER, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      // No point checking membership on a task that isn't there.
      expect(mockAccess.assertMember).not.toHaveBeenCalled();
    });
  });

  describe('updateTaskStatus', () => {
    it('lets any member move a task, not just its creator', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.task.update.mockResolvedValue({
        ...task,
        status: TaskStatus.DONE,
      });

      const result = await service.updateTaskStatus(MEMBER, TASK, {
        status: TaskStatus.DONE,
      });

      expect(result.data.newStatus).toBe(TaskStatus.DONE);
      expect(mockAccess.assertMember).toHaveBeenCalledWith(MEMBER, PROJECT);
    });

    // A failed check must happen before the write, not after.
    it('does not write when the access check fails', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockAccess.assertMember.mockRejectedValue(new NotFoundException());

      await expect(
        service.updateTaskStatus(STRANGER, TASK, { status: TaskStatus.DONE }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });
  });
});
