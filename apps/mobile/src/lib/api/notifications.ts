import { apiClient } from './client';
import type {
  AcceptTargetedInviteResponse,
  DeclineInviteResponse,
  DismissNotificationResponse,
  GetNotificationsResponse,
  GetPendingInvitesResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
} from '@repo/types';

/**
 * The user's notifications, newest first.
 * GET /notification
 */
export const getNotifications = async (
  params?: { page?: number; limit?: number; unreadOnly?: boolean },
): Promise<GetNotificationsResponse> => {
  const response = await apiClient.get<GetNotificationsResponse>('/notification', {
    params,
  });
  return response.data;
};

/**
 * Mark one notification read. Already-read is a no-op success, so a double tap
 * is safe.
 * PATCH /notification/:id/read
 */
export const markNotificationRead = async (
  id: string,
): Promise<MarkNotificationReadResponse> => {
  const response = await apiClient.patch<MarkNotificationReadResponse>(
    `/notification/${id}/read`,
  );
  return response.data;
};

/**
 * Mark every unread notification read.
 * PATCH /notification/read-all
 */
export const markAllNotificationsRead =
  async (): Promise<MarkAllNotificationsReadResponse> => {
    const response = await apiClient.patch<MarkAllNotificationsReadResponse>(
      '/notification/read-all',
    );
    return response.data;
  };

/**
 * Remove a single notification.
 * DELETE /notification/:id
 */
export const dismissNotification = async (
  id: string,
): Promise<DismissNotificationResponse> => {
  const response = await apiClient.delete<DismissNotificationResponse>(
    `/notification/${id}`,
  );
  return response.data;
};

/**
 * Invitations addressed to the current user, pending and unexpired.
 * GET /invites/pending
 */
export const getPendingInvites = async (): Promise<GetPendingInvitesResponse> => {
  const response = await apiClient.get<GetPendingInvitesResponse>('/invites/pending');
  return response.data;
};

/**
 * Accept an invitation addressed to you. Keyed on invite id, not a share code.
 * POST /invites/:inviteId/accept-invite
 */
export const acceptTargetedInvite = async (
  inviteId: string,
): Promise<AcceptTargetedInviteResponse> => {
  const response = await apiClient.post<AcceptTargetedInviteResponse>(
    `/invites/${inviteId}/accept-invite`,
  );
  return response.data;
};

/**
 * Decline an invitation addressed to you. Only the sender is told.
 * POST /invites/:inviteId/decline
 */
export const declineInvite = async (
  inviteId: string,
): Promise<DeclineInviteResponse> => {
  const response = await apiClient.post<DeclineInviteResponse>(
    `/invites/${inviteId}/decline`,
  );
  return response.data;
};
