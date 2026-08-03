import { Notification, NotificationType } from "@repo/db";
import { PaginationInfo } from 'src/common/types/type';
import { MinimalUserSelect } from 'src/users/queries';

export interface GetNotification extends Notification {
  actor?: MinimalUserSelect;
}

export interface GetAllNotificationsResponse {
  notifications: GetNotification[];
  pagination: PaginationInfo;
  /** Unread total for the badge — not the size of the current page or filter. */
  unreadCount: number;
}

export enum NOTIFICATION_MEDIUM {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'inApp',
}

/** What a producer hands NotificationsService.notify(). */
export type NotifyPayload = {
  title: string;
  message: string;
  url?: string;
  type?: NotificationType;
  /** Set only for PROJECT_INVITE, so the row can carry accept/decline. */
  inviteId?: string;
};
