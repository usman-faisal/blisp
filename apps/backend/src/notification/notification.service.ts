import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import {
  GetAllNotificationsResponse,
  GetNotification,
} from './types';
import {  Prisma } from "@repo/db";
import { throwError } from 'src/common/utils/helpers';
import { ApiResponse, QueryParams } from 'src/common/types/type';
import { minimalUserSelect, MinimalUserSelect } from 'src/user/queries';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllNotifications(
    user: MinimalUserSelect,
    query?: QueryParams,
  ): Promise<ApiResponse<GetAllNotificationsResponse>> {
    try {
      const { page = 1, limit = 30 } = query || {};

      const where: Prisma.NotificationWhereInput = {
        userId: user.id,
      };
      const skip = (Number(page) - 1) * Number(limit);
      const [notifications, totalCount] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.notification.count({ where }),
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

      if (notifications.length === 0) {
        return {
          message: 'Notifications retrieved successfully',
          success: true,
          data: {
            notifications: [],
            pagination,
          },
        };
      }

      return {
        message: 'Notifications retrieved successfully',
        success: true,
        data: {
          notifications: notifications as GetNotification[],
          pagination,
        },
      };
    } catch (err: any) {
      throw throwError(err.message || 'Failed to get notifications', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async clearAllNotifications(user: MinimalUserSelect): Promise<ApiResponse> {
    try {
      await Promise.all([
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
