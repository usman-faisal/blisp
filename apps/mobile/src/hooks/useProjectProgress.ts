import { useCallback, useEffect, useState } from 'react';
import type { ProjectProgressPayload } from '@repo/types';
import { getProjectProgress } from '../lib/api/collaboration';

/**
 * Overall and per-member completion for a project.
 *
 * Follows the fetch-and-mutate shape of the other hooks in this directory
 * rather than introducing React Query alongside them.
 */
export function useProjectProgress(projectId: string) {
  const [data, setData] = useState<ProjectProgressPayload | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProgress = useCallback(
    async (showLoading = false) => {
      if (!projectId) return;
      if (showLoading) setIsLoading(true);
      try {
        const response = await getProjectProgress(projectId);
        if (response.success) {
          setData(response.data);
        }
      } catch (error) {
        console.error('Error fetching project progress:', error);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    fetchProgress(true);
  }, [fetchProgress]);

  const mutate = useCallback(() => fetchProgress(false), [fetchProgress]);

  return { data, isLoading, mutate };
}
