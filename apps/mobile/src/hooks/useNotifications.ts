import { useCallback, useEffect, useState } from 'react';
import type { NotificationResponse } from '@repo/types';
import { getNotifications } from '../lib/api/notifications';

/**
 * The user's notifications, newest first, with the unread total for the badge.
 *
 * Follows the fetch-and-mutate shape of the other hooks in this directory rather
 * than introducing React Query alongside them.
 *
 * Exposes `setData` and `setUnreadCount` like useTaskComments does: marking a
 * notification read is written straight into the list, because refetching the
 * whole page to dim one row is a round trip the user waits through for something
 * already on screen.
 */
interface UseNotificationsOptions {
  /**
   * Refetch every N milliseconds. Used by the tab layout, which mounts once and
   * therefore never re-runs a focus effect of its own — and which also has to
   * notice notifications arriving while the user sits on another screen.
   *
   * Omit for screen-level use, where a focus effect or pull-to-refresh is the
   * right trigger and a timer would just be extra requests.
   */
  pollMs?: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { pollMs } = options;

  const [data, setData] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await getNotifications();
      if (response.success) {
        setData(response.data.notifications);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!pollMs) return;

    // Silent refetches: showing the spinner every 30s would make the screen
    // flicker for a count the user is not waiting on.
    const id = setInterval(() => fetchNotifications(false), pollMs);

    return () => clearInterval(id);
  }, [pollMs, fetchNotifications]);

  const mutate = useCallback(() => fetchNotifications(false), [fetchNotifications]);

  return { data, setData, unreadCount, setUnreadCount, isLoading, mutate };
}
