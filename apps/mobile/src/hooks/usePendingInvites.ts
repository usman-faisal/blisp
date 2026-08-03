import { useCallback, useEffect, useState } from 'react';
import type { PendingInvitePayload } from '@repo/types';
import { getPendingInvites } from '../lib/api/notifications';

/**
 * Invitations addressed to the current user and still awaiting an answer.
 *
 * Read from /invites/pending rather than filtered out of the notification list.
 * The two can disagree — a notification is dismissible and an invite outlives
 * being dismissed — and the invite table is the authority on what is actually
 * still open.
 */
export function usePendingInvites() {
  const [data, setData] = useState<PendingInvitePayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInvites = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await getPendingInvites();
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Error fetching pending invites:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites(true);
  }, [fetchInvites]);

  const mutate = useCallback(() => fetchInvites(false), [fetchInvites]);

  return { data, setData, isLoading, mutate };
}
