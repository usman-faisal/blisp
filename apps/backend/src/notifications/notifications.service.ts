import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import {
  GetAllNotificationsResponse,
  GetNotification,
  NotifyPayload,
} from './types';
import { Prisma } from '@repo/db';
import { throwError } from 'src/common/utils/helpers';
import { ApiResponse, QueryParams } from 'src/common/types/type';
import { MinimalUserSelect } from 'src/users/queries';

/** Extra filters the notification list accepts beyond paging. */
export interface NotificationQueryParams extends QueryParams {
  unreadOnly?: string | boolean;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes notifications and flips User.hasNotifications, which drives the
   * unread badge. Writing the rows without the flag would leave the badge dark.
   *
   * Lives here rather than on the collaboration listener because there is now
   * more than one producer: invites are created in InvitesService, which cannot
   * reach a private method on a listener.
   */
  async notify(userIds: string[], payload: NotifyPayload): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, ...payload })),
      }),
      this.prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { hasNotifications: true },
      }),
    ]);
  }

  /**
   * Recomputes hasNotifications from the rows that actually remain unread.
   *
   * Every mutation below calls this rather than assuming: marking one
   * notification read only darkens the badge when it was the *last* unread one,
   * and guessing either way leaves the badge lying about the list's contents.
   *
   * Takes a transaction client so the recount cannot race the write that
   * prompted it.
   */
  private async syncBadge(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const unread = await tx.notification.count({
      where: { userId, readAt: null },
    });

    await tx.user.update({
      where: { id: userId },
      data: { hasNotifications: unread > 0 },
    });
  }

  async getAllNotifications(
    user: MinimalUserSelect,
    query?: NotificationQueryParams,
  ): Promise<ApiResponse<GetAllNotificationsResponse>> {
    try {
      const { page = 1, limit = 30, unreadOnly } = query || {};

      // Query strings arrive as text, so `unreadOnly=false` would be truthy if
      // taken at face value.
      const filterUnread = unreadOnly === true || unreadOnly === 'true';

      const where: Prisma.NotificationWhereInput = {
        userId: user.id,
        ...(filterUnread ? { readAt: null } : {}),
      };
      const skip = (Number(page) - 1) * Number(limit);

      // unreadCount ignores `where` on purpose: it is the badge total, not the
      // size of the current page or filter.
      const [notifications, totalCount, unreadCount] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.notification.count({ where }),
        this.prisma.notification.count({
          where: { userId: user.id, readAt: null },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / Number(limit));

      const pagination = {
        totalCount,
        totalPages,
        page: Number(page),
        limit: Number(limit),
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      };

      return {
        message: 'Notifications retrieved successfully',
        success: true,
        data: {
          notifications: notifications as GetNotification[],
          pagination,
          unreadCount,
        },
      };
    } catch (err: any) {
      throw throwError(err.message || 'Failed to get notifications', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Marks one notification read.
   *
   * Scoped by userId as well as id, so a user cannot mark someone else's
   * notification read by guessing a uuid. A miss is NotFound rather than
   * Forbidden — the same reasoning as ProjectAccessService.assertMember: 403
   * would confirm the row exists.
   */
  async markAsRead(
    user: MinimalUserSelect,
    notificationId: string,
  ): Promise<ApiResponse<{ id: string; unreadCount: number }>> {
    try {
      const unreadCount = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.notification.updateMany({
          // Already-read rows keep their original readAt: re-reading something
          // should not move its timestamp.
          where: { id: notificationId, userId: user.id, readAt: null },
          data: { readAt: new Date() },
        });

        if (updated.count === 0) {
          // Either it is not ours, does not exist, or was already read. Only the
          // first two are errors, so confirm which before throwing.
          const exists = await tx.notification.findFirst({
            where: { id: notificationId, userId: user.id },
            select: { id: true },
          });

          if (!exists) {
            throw new NotFoundException('Notification not found.');
          }
        }

        await this.syncBadge(tx, user.id);

        return tx.notification.count({
          where: { userId: user.id, readAt: null },
        });
      });

      return {
        message: 'Notification marked as read',
        success: true,
        data: { id: notificationId, unreadCount },
      };
    } catch (err: any) {
      throw throwError(
        err.message || 'Failed to mark notification as read',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async markAllAsRead(
    user: MinimalUserSelect,
  ): Promise<ApiResponse<{ updated: number }>> {
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.notification.updateMany({
          where: { userId: user.id, readAt: null },
          data: { readAt: new Date() },
        });

        await tx.user.update({
          where: { id: user.id },
          data: { hasNotifications: false },
        });

        return result.count;
      });

      return {
        message: 'All notifications marked as read',
        success: true,
        data: { updated },
      };
    } catch (err: any) {
      throw throwError(
        err.message || 'Failed to mark all notifications as read',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Dismisses a single notification. Same ownership scoping as markAsRead. */
  async dismissNotification(
    user: MinimalUserSelect,
    notificationId: string,
  ): Promise<ApiResponse<{ id: string; unreadCount: number }>> {
    try {
      const unreadCount = await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.notification.deleteMany({
          where: { id: notificationId, userId: user.id },
        });

        if (deleted.count === 0) {
          throw new NotFoundException('Notification not found.');
        }

        // Dismissing the last unread row must darken the badge.
        await this.syncBadge(tx, user.id);

        return tx.notification.count({
          where: { userId: user.id, readAt: null },
        });
      });

      return {
        message: 'Notification dismissed',
        success: true,
        data: { id: notificationId, unreadCount },
      };
    } catch (err: any) {
      throw throwError(
        err.message || 'Failed to dismiss notification',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async clearAllNotifications(user: MinimalUserSelect): Promise<ApiResponse> {
    try {
      // One transaction, not Promise.all: a delete that lands while the flag
      // update fails leaves the badge lit over an empty list.
      await this.prisma.$transaction([
        this.prisma.notification.deleteMany({
          where: {
            userId: user.id,
          },
        }),
        this.prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            hasNotifications: false,
          },
        }),
      ]);

      return {
        message: 'All notifications cleared successfully',
        success: true,
      };
    } catch (err: any) {
      throw throwError(
        err.message || 'Failed to clear all notifications',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
