import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/services/prisma.service';
import { CollaborationNotificationsListener } from '../collaboration-notifications.listener';
import {
  MemberJoinedEvent,
  TaskAssignedEvent,
  TaskCommentedEvent,
  TaskCompletedEvent,
} from '../events/collaboration.events';

/** Phase 5: collaboration events → notifications. */
describe('CollaborationNotificationsListener', () => {
  let listener: CollaborationNotificationsListener;

  const mockPrisma = {
    notification: { createMany: jest.fn() },
    user: { updateMany: jest.fn() },
    projectMember: { findMany: jest.fn() },
    $transaction: jest.fn((ops: any) => Promise.all(ops)),
  };

  const ALICE = 'user_alice';
  const BOB = 'user_bob';
  const CAROL = 'user_carol';
  const PROJECT = 'project-1';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((ops: any) => Promise.all(ops));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationNotificationsListener,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    listener = module.get(CollaborationNotificationsListener);
  });

  describe('member joined', () => {
    it('notifies the existing members', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([
        { userId: ALICE },
        { userId: BOB },
      ]);

      await listener.onMemberJoined(
        new MemberJoinedEvent(PROJECT, 'Shared roadmap', CAROL, 'Carol'),
      );

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ userId: ALICE, title: 'New collaborator' }),
          expect.objectContaining({ userId: BOB }),
        ],
      });
    });

    // Being told you joined is noise.
    it('excludes the joiner from the recipients', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([{ userId: ALICE }]);

      await listener.onMemberJoined(
        new MemberJoinedEvent(PROJECT, 'Shared roadmap', CAROL, 'Carol'),
      );

      expect(mockPrisma.projectMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: PROJECT, userId: { not: CAROL } },
        }),
      );
    });

    // The unread badge is driven by this flag; rows alone leave it dark.
    it('sets hasNotifications so the badge lights up', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([{ userId: ALICE }]);

      await listener.onMemberJoined(
        new MemberJoinedEvent(PROJECT, 'Shared roadmap', CAROL, 'Carol'),
      );

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [ALICE] } },
        data: { hasNotifications: true },
      });
    });

    it('writes nothing when the joiner is the only member', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([]);

      await listener.onMemberJoined(
        new MemberJoinedEvent(PROJECT, 'Solo', CAROL, 'Carol'),
      );

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    // A notification failure must never surface to the caller — the join
    // already committed.
    it('swallows errors rather than failing the join', async () => {
      mockPrisma.projectMember.findMany.mockRejectedValue(new Error('db down'));

      await expect(
        listener.onMemberJoined(new MemberJoinedEvent(PROJECT, 'X', CAROL, 'Carol')),
      ).resolves.toBeUndefined();
    });
  });

  describe('task assigned', () => {
    it('notifies the assignee', async () => {
      await listener.onTaskAssigned(
        new TaskAssignedEvent('task-1', 'Wire up auth', 'Roadmap', BOB, ALICE, 'Alice'),
      );

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ userId: BOB, title: 'Task assigned to you' })],
      });
    });

    it('says nothing when a task is unassigned', async () => {
      await listener.onTaskAssigned(
        new TaskAssignedEvent('task-1', 'Wire up auth', 'Roadmap', null, ALICE, 'Alice'),
      );

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    // Claiming a task yourself does not need an announcement.
    it('does not notify on self-assignment', async () => {
      await listener.onTaskAssigned(
        new TaskAssignedEvent('task-1', 'Wire up auth', 'Roadmap', ALICE, ALICE, 'Alice'),
      );

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('task commented', () => {
    const commentEvent = (overrides: Partial<TaskCommentedEvent> = {}) =>
      new TaskCommentedEvent(
        'task-1',
        'Wire up auth',
        PROJECT,
        'Roadmap',
        (overrides as any).actorId ?? ALICE,
        'Alice',
        (overrides as any).projectOwnerId ?? BOB,
        (overrides as any).mentionedUserIds ?? [],
        'Looks good to me',
      );

    it('notifies the project owner of every comment', async () => {
      await listener.onTaskCommented(commentEvent());

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ userId: BOB, title: 'New comment' })],
      });
    });

    it('notifies a mentioned member', async () => {
      await listener.onTaskCommented(commentEvent({ mentionedUserIds: [CAROL] } as any));

      const calls = mockPrisma.notification.createMany.mock.calls;
      const mention = calls.find((c: any) => c[0].data[0].title === 'You were mentioned');

      expect(mention[0].data[0].userId).toBe(CAROL);
    });

    // Being told twice about one comment reads as a bug.
    it('sends a mentioned owner only the mention, not both', async () => {
      await listener.onTaskCommented(commentEvent({ mentionedUserIds: [BOB] } as any));

      const titles = mockPrisma.notification.createMany.mock.calls.map(
        (c: any) => c[0].data[0].title,
      );

      expect(titles).toEqual(['You were mentioned']);
      expect(titles).not.toContain('New comment');
    });

    it('does not notify the author when they own the project', async () => {
      await listener.onTaskCommented(
        commentEvent({ actorId: ALICE, projectOwnerId: ALICE } as any),
      );

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('ignores a self-mention', async () => {
      await listener.onTaskCommented(
        commentEvent({ actorId: ALICE, mentionedUserIds: [ALICE], projectOwnerId: ALICE } as any),
      );

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('notifies both a mentioned member and the owner separately', async () => {
      await listener.onTaskCommented(commentEvent({ mentionedUserIds: [CAROL] } as any));

      const titles = mockPrisma.notification.createMany.mock.calls.map(
        (c: any) => c[0].data[0].title,
      );

      expect(titles).toEqual(
        expect.arrayContaining(['You were mentioned', 'New comment']),
      );
    });
  });

  describe('task completed', () => {
    it('notifies the other members', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([{ userId: BOB }]);

      await listener.onTaskCompleted(
        new TaskCompletedEvent('task-1', 'Wire up auth', PROJECT, 'Roadmap', ALICE, 'Alice'),
      );

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ userId: BOB, title: 'Task completed' })],
      });
    });

    it('excludes whoever completed it', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([{ userId: BOB }]);

      await listener.onTaskCompleted(
        new TaskCompletedEvent('task-1', 'Wire up auth', PROJECT, 'Roadmap', ALICE, 'Alice'),
      );

      expect(mockPrisma.projectMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: PROJECT, userId: { not: ALICE } },
        }),
      );
    });

    it('writes nothing on a solo project', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([]);

      await listener.onTaskCompleted(
        new TaskCompletedEvent('task-1', 'Wire up auth', PROJECT, 'Solo', ALICE, 'Alice'),
      );

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });
  });
});
