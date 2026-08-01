import { useCallback, useEffect, useState } from 'react';
import type { ProjectMemberResponse } from '@repo/types';
import { getProjectMembers } from '../lib/api/collaboration';

/**
 * Members of a project, owner first.
 *
 * Follows the fetch-and-mutate shape of the other hooks in this directory
 * rather than introducing React Query alongside them.
 */
export function useProjectMembers(projectId: string) {
  const [data, setData] = useState<ProjectMemberResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMembers = useCallback(
    async (showLoading = false) => {
      if (!projectId) return;
      if (showLoading) setIsLoading(true);
      try {
        const response = await getProjectMembers(projectId);
        if (response.success) {
          setData(response.data);
        }
      } catch (error) {
        console.error('Error fetching project members:', error);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    fetchMembers(true);
  }, [fetchMembers]);

  const mutate = useCallback(() => fetchMembers(false), [fetchMembers]);

  return { data, isLoading, mutate };
}
