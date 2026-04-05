import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { GetProjectStatsResponse, ProjectStatsResponsePayload } from '@repo/types';

async function fetchProjectStats(): Promise<ProjectStatsResponsePayload> {
  const { data } = await apiClient.get<GetProjectStatsResponse>('/projects/stats');
  return data.data;
}

export function useProjectStats() {
  return useQuery({
    queryKey: ['projectStats'],
    queryFn: fetchProjectStats,
  });
}
