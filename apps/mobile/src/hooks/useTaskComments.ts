import { useCallback, useEffect, useState } from 'react';
import type { TaskCommentResponse } from '@repo/types';
import { getTaskComments } from '../lib/api/collaboration';

/**
 * A task's comment thread, oldest first.
 *
 * Follows the fetch-and-mutate shape of the other hooks in this directory
 * rather than introducing React Query alongside them.
 */
export function useTaskComments(taskId: string) {
  const [data, setData] = useState<TaskCommentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchComments = useCallback(
    async (showLoading = false) => {
      if (!taskId) return;
      if (showLoading) setIsLoading(true);
      try {
        const response = await getTaskComments(taskId);
        if (response.success) {
          setData(response.data);
        }
      } catch (error) {
        console.error('Error fetching task comments:', error);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    fetchComments(true);
  }, [fetchComments]);

  const mutate = useCallback(() => fetchComments(false), [fetchComments]);

  return { data, setData, isLoading, mutate };
}
