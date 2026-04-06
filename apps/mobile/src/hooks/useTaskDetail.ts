import { useState, useCallback, useEffect } from 'react';
import { getTaskById } from '@/lib/api/tasks';
import type { TaskDetailResponsePayload } from '@repo/types';

export function useTaskDetail(taskId: string) {
  const [data, setData] = useState<TaskDetailResponsePayload | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const response = await getTaskById(taskId);
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('[useTaskDetail] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const mutate = useCallback(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, mutate };
}
