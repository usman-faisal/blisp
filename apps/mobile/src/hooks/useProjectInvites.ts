import { useCallback, useEffect, useState } from 'react';
import type { OutgoingInvitePayload } from '@repo/types';
import { getProjectInvites } from '../lib/api/collaboration';

/**
 * Outgoing invitations for a project — the sender's side of "awaiting reply".
 *
 * Follows the fetch-and-mutate shape of the other hooks in this directory rather
 * than introducing React Query alongside them.
 *
 * The backend returns pending and unexpired invites only, so this list shrinks
 * silently when someone answers or an invite lapses. That is why `setData` is
 * exposed: revoking writes the removal straight in, and the refetch that follows
 * confirms it rather than being what makes the row disappear.
 */
export function useProjectInvites(projectId: string) {
  const [data, setData] = useState<OutgoingInvitePayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInvites = useCallback(
    async (showLoading = false) => {
      if (!projectId) return;
      if (showLoading) setIsLoading(true);
      try {
        const response = await getProjectInvites(projectId);
        if (response.success) {
          setData(response.data);
        }
      } catch (error) {
        // Non-fatal: the members list is the primary content of the screen and
        // still renders. Losing the outgoing section is better than an error
        // state over the whole page.
        console.error('Error fetching project invites:', error);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    fetchInvites(true);
  }, [fetchInvites]);

  const mutate = useCallback(() => fetchInvites(false), [fetchInvites]);

  return { data, setData, isLoading, mutate };
}
