import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { NotificationsService } from '../notifications.service';

/**
 * Slice 8A: read state and the badge.
 *
 * The recurring risk in here is `User.hasNotifications` drifting from the rows:
 * a badge that stays lit over an all-read list, or goes dark with unread rows
 * left. Most of these tests exist to pin one direction of that.
 */
describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrisma = {
    notification: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: { update: jest.fn(), updateMany: jest.fn() },
    // Handles both forms: an array of operations, and a callback given a tx
    // client. The callback form runs against the same mocks, so the transaction
    // body is genuinely exercised rather than skipped.
    $transaction: jest.fn(),
  };

  const ALICE = { id: 'user_alice', name: 'Alice', email: 'alice@example.com' };
  const NOTIFICATION_ID = 'c8f1e1a0-0000-4000-8000-000000000001';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((arg: any) =>
      typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('notify', () => {
    it('writes the rows and lights the badge in one transaction', async () => {
      await service.notify([ALICE.id], {
        title: 'Task assigned to you',
        message: 'Alice assigned you a task.',
        type: NotificationType.TASK_ASSIGNED,
      });

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ userId: ALICE.id })],
      });
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [ALICE.id] } },
        data: { hasNotifications: true },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('no-ops on an empty recipient list', async () => {
      await service.notify([], { title: 'x', message: 'y' });

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    // The columns are new; a payload that silently dropped them would still
    // return a valid-looking row.
    it('persists type and inviteId', async () => {
      await service.notify([ALICE.id], {
        title: 'Project invite',
        message: 'Bob invited you.',
        type: NotificationType.PROJECT_INVITE,
        inviteId: 'invite-1',
      });

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            type: NotificationType.PROJECT_INVITE,
            inviteId: 'invite-1',
          }),
        ],
      });
    });
  });

  describe('getAllNotifications', () => {
    beforeEach(() => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);
    });

    it('returns the unread count for the badge', async () => {
      mockPrisma.notification.count
        .mockResolvedValueOnce(10) // totalCount
        .mockResolvedValueOnce(3); // unreadCount

      const result = await service.getAllNotifications(ALICE);

      expect(result.data.unreadCount).toBe(3);
    });

    // Asserted on the where clause, not the output: a dropped filter still
    // returns rows, so an output-only assertion would pass.
    it('filters to unread when unreadOnly is set', async () => {
      await service.getAllNotifications(ALICE, { unreadOnly: 'true' });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: ALICE.id, readAt: null },
        }),
      );
    });

    it('does not filter when unreadOnly is absent', async () => {
      await service.getAllNotifications(ALICE);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: ALICE.id } }),
      );
    });

    // Query strings are text, so a naive truthiness check would treat the
    // string "false" as true.
    it('treats the string "false" as not filtering', async () => {
      await service.getAllNotifications(ALICE, { unreadOnly: 'false' });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: ALICE.id } }),
      );
    });

    // The badge counts everything unread, not just what this filter returned.
    it('counts unread independently of the filter', async () => {
      await service.getAllNotifications(ALICE, { unreadOnly: 'true' });

      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: ALICE.id, readAt: null },
      });
    });

    it('scopes every read to the requesting user', async () => {
      await service.getAllNotifications(ALICE);

      for (const call of mockPrisma.notification.findMany.mock.calls) {
        expect(call[0].where.userId).toBe(ALICE.id);
      }
    });
  });

  describe('markAsRead', () => {
    it('sets readAt on the caller’s row', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.markAsRead(ALICE, NOTIFICATION_ID);

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID, userId: ALICE.id, readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });

    // Without userId in the where clause, any uuid guess would mark someone
    // else's notification read.
    it('rejects a notification belonging to another user', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead(ALICE, NOTIFICATION_ID)).rejects.toThrow(
        /not found/i,
      );
    });

    it('does not touch the badge when the row is not ours', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead(ALICE, NOTIFICATION_ID)).rejects.toThrow();

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    // Re-reading an already-read notification is a no-op success, not a 404 —
    // a double tap should not read as an error.
    it('succeeds when the row is already read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.notification.findFirst.mockResolvedValue({ id: NOTIFICATION_ID });
      mockPrisma.notification.count.mockResolvedValue(0);

      const result = await service.markAsRead(ALICE, NOTIFICATION_ID);

      expect(result.success).toBe(true);
    });

    it('darkens the badge when it was the last unread', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.count.mockResolvedValue(0);

      const result = await service.markAsRead(ALICE, NOTIFICATION_ID);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: ALICE.id },
        data: { hasNotifications: false },
      });
      expect(result.data.unreadCount).toBe(0);
    });

    // The other half of the same rule, and the easier one to get backwards.
    it('leaves the badge lit when other rows are still unread', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.count.mockResolvedValue(2);

      const result = await service.markAsRead(ALICE, NOTIFICATION_ID);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: ALICE.id },
        data: { hasNotifications: true },
      });
      expect(result.data.unreadCount).toBe(2);
    });
  });

  describe('markAllAsRead', () => {
    it('marks the unread rows and clears the flag', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const result = await service.markAllAsRead(ALICE);

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: ALICE.id, readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: ALICE.id },
        data: { hasNotifications: false },
      });
      expect(result.data.updated).toBe(4);
    });

    // Rewriting readAt on already-read rows would lose when they were first read.
    it('does not rewrite timestamps on already-read rows', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });

      await service.markAllAsRead(ALICE);

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ readAt: null }),
        }),
      );
    });
  });

  describe('dismissNotification', () => {
    it('deletes the caller’s row and recomputes the badge', async () => {
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.dismissNotification(ALICE, NOTIFICATION_ID);

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID, userId: ALICE.id },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: ALICE.id },
        data: { hasNotifications: false },
      });
    });

    it('rejects a row belonging to another user', async () => {
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.dismissNotification(ALICE, NOTIFICATION_ID),
      ).rejects.toThrow(/not found/i);
    });

    // Deleting an unread row while others remain must not darken the badge.
    it('keeps the badge lit when unread rows remain', async () => {
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.dismissNotification(ALICE, NOTIFICATION_ID);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: ALICE.id },
        data: { hasNotifications: true },
      });
      expect(result.data.unreadCount).toBe(1);
    });
  });

  describe('clearAllNotifications', () => {
    // Was Promise.all: a delete landing while the flag update failed left the
    // badge lit over an empty list.
    it('deletes and clears the flag in one transaction', async () => {
      await service.clearAllNotifications(ALICE);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: ALICE.id },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: ALICE.id },
        data: { hasNotifications: false },
      });
    });
  });
});
