import { apiClient } from './client';
import { ActivateProjectResponse, GetProjectsResponse } from '@repo/types';
/**
 * Activate an incubator project — moves it into the user's active focus.
 * POST /projects/:id/activate
 */
export const activateProject = async (projectId: string): Promise<ActivateProjectResponse> => {
  const response = await apiClient.post<ActivateProjectResponse>(
    `/projects/${projectId}/activate`,
  );
  return response.data;
};


/**
 * Get projects via optional status.
 * GET /projects
 */
export const getProjects = async (status?: string): Promise<GetProjectsResponse> => {
  const response = await apiClient.get<GetProjectsResponse>('/projects', {
    params: { status }
  });
  return response.data;
};
