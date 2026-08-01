import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectRole } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { COLLABORATION_EVENTS } from 'src/notifications/events/collaboration.events';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { CommentsService } from '../comments.service';

describe('CommentsService', () => {
  let service: CommentsService;

  const mockPrisma = {
    task: { findUnique: jest.fn() },
    taskComment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    projectMember: { findMany: jest.fn() },
  };

  const mockAccess = {
    assertMember: jest.fn(),
    assertOwner: jest.fn(),
    isMember: jest.fn(),
    memberProjectIds: jest.fn(),
  };

  const mockEvents = { emit: jest.fn() };

  const OWNER = 'u_owner';
  const AUTHOR = 'u_author';
  const OTHER = 'u_other';
  const TASK = 'task-1';
  const PROJECT = 'project-1';

  const task = {
    id: TASK,
    title: 'Wire up auth',
    projectId: PROJECT,
    project: { title: 'Shared roadmap', userId: OWNER },
  };

  const members = [
    { userId: OWNER, user: { name: 'Alice' } },
    { userId: AUTHOR, user: { name: 'Bob' } },
    { userId: OTHER, user: { name: 'test user' } },
  ];

  const comment = {
    id: 'comment-1',
    taskId: TASK,
    authorId: AUTHOR,
    authorName: 'Bob',
    body: 'Looks good',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date('2026-08-01T10:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.task.findUnique.mockResolvedValue(task);
    mockPrisma.projectMember.findMany.mockResolvedValue(members);
    mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectAccessService, useValue: mockAccess },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('createComment', () => {
    it('stores the comment with an author byline snapshot', async () => {
      mockPrisma.taskComment.create.mockResolvedValue(comment);

      const result = await service.createComment(AUTHOR, TASK, { body: 'Looks good' });

      expect(result.data.authorName).toBe('Bob');
      expect(mockPrisma.taskComment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ authorId: AUTHOR, authorName: 'Bob' }),
      });
    });

    it('emits an event carrying the project owner and mentions', async () => {
      mockPrisma.taskComment.create.mockResolvedValue({
        ...comment,
        body: '@test user please check',
      });

      await service.createComment(AUTHOR, TASK, { body: '@test user please check' });

      const [eventName, payload] = mockEvents.emit.mock.calls[0];

      expect(eventName).toBe(COLLABORATION_EVENTS.TASK_COMMENTED);
      expect(payload.projectOwnerId).toBe(OWNER);
      expect(payload.mentionedUserIds).toEqual([OTHER]);
      expect(payload.actorId).toBe(AUTHOR);
    });

    it('emits with no mentions for a plain comment', async () => {
      mockPrisma.taskComment.create.mockResolvedValue(comment);

      await service.createComment(AUTHOR, TASK, { body: 'Looks good' });

      expect(mockEvents.emit.mock.calls[0][1].mentionedUserIds).toEqual([]);
    });

    it('rejects a non-member', async () => {
      mockAccess.assertMember.mockRejectedValue(new NotFoundException());

      await expect(
        service.createComment('u_stranger', TASK, { body: 'hi' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.taskComment.create).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.createComment(AUTHOR, 'missing', { body: 'hi' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getComments', () => {
    it('marks the requester\'s own comments', async () => {
      mockPrisma.taskComment.findMany.mockResolvedValue([
        comment,
        { ...comment, id: 'comment-2', authorId: OWNER, authorName: 'Alice' },
      ]);

      const result = await service.getComments(AUTHOR, TASK);

      expect(result.data[0].isOwn).toBe(true);
      expect(result.data[1].isOwn).toBe(false);
    });

    it('resolves mentions for display', async () => {
      mockPrisma.taskComment.findMany.mockResolvedValue([
        { ...comment, body: '@Alice thoughts?' },
      ]);

      const result = await service.getComments(AUTHOR, TASK);

      expect(result.data[0].mentionedUserIds).toEqual([OWNER]);
    });
  });

  describe('updateComment', () => {
    beforeEach(() => {
      mockPrisma.taskComment.findUnique.mockResolvedValue({
        ...comment,
        task: { projectId: PROJECT },
      });
    });

    it('lets the author edit their own comment', async () => {
      mockPrisma.taskComment.update.mockResolvedValue({ ...comment, body: 'Edited' });

      const result = await service.updateComment(AUTHOR, 'comment-1', { body: 'Edited' });

      expect(result.data.body).toBe('Edited');
    });

    // Editing someone else's words is never acceptable, even for the owner.
    it('refuses to let anyone else edit, including the owner', async () => {
      await expect(
        service.updateComment(OWNER, 'comment-1', { body: 'Rewritten' }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.taskComment.update).not.toHaveBeenCalled();
    });

    // Re-notifying on every typo fix would make mentions a nuisance.
    it('does not emit an event on edit', async () => {
      mockPrisma.taskComment.update.mockResolvedValue({ ...comment, body: 'Edited' });

      await service.updateComment(AUTHOR, 'comment-1', { body: 'Edited' });

      expect(mockEvents.emit).not.toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    beforeEach(() => {
      mockPrisma.taskComment.findUnique.mockResolvedValue({
        ...comment,
        task: { projectId: PROJECT },
      });
    });

    it('lets the author delete their own comment', async () => {
      await service.deleteComment(AUTHOR, 'comment-1');

      expect(mockPrisma.taskComment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
      });
    });

    it('lets the project owner moderate', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.OWNER });

      await service.deleteComment(OWNER, 'comment-1');

      expect(mockPrisma.taskComment.delete).toHaveBeenCalled();
    });

    it('refuses a member deleting someone else\'s comment', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });

      await expect(service.deleteComment(OTHER, 'comment-1')).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockPrisma.taskComment.delete).not.toHaveBeenCalled();
    });
  });
});
