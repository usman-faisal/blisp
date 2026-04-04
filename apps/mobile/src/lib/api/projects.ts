import { apiClient } from './client';

export interface ActivateProjectResponse {
  data: {
    id: string;
    status: string;
  };
  message: string;
  success: boolean;
}

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
