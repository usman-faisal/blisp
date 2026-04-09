import { useState, useCallback, useEffect } from 'react';
import { getProjectById } from '../lib/api/projects';
import type { ProjectDetailResponsePayload } from '@repo/types';

export function useProjectDetail(projectId: string) {
  const [data, setData] = useState<ProjectDetailResponsePayload | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProject = useCallback(async (showLoading = false) => {
    if (!projectId) return;
    if (showLoading) setIsLoading(true);
    try {
      const response = await getProjectById(projectId);
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Error fetching project detail:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject(true);
  }, [fetchProject]);

  const mutate = useCallback(() => {
    return fetchProject(false);
  }, [fetchProject]);

  return { data, isLoading, mutate };
}
