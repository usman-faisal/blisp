import { Notification } from "@repo/db";
import { PaginationInfo } from 'src/common/types/type';
import { MinimalUserSelect } from 'src/users/queries';

export interface GetNotification extends Notification {
  actor?: MinimalUserSelect;
}

export interface GetAllNotificationsResponse {
  notifications: GetNotification[];
  pagination: PaginationInfo;
}

export enum NOTIFICATION_MEDIUM {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'inApp',
}

export type CreateNotificationPayload = {
  title: string;
  message?: string;
  url?: string;
  priority?: number;
  actorId?: string;
  entityId?: string;
  entityType?: string; // TODO: Implement enum for entity types
};
