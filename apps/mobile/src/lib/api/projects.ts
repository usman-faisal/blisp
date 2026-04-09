import { apiClient } from './client';
import { ActivateProjectResponse, ArchiveProjectResponse, GetProjectsResponse, GetProjectDetailResponse, GetProjectPipelineResponse, UpdateProjectResponse } from '@repo/types';
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

/**
 * Get a single project with its tasks.
 * GET /projects/:id
 */
export const getProjectById = async (projectId: string): Promise<GetProjectDetailResponse> => {
  const response = await apiClient.get<GetProjectDetailResponse>(`/projects/${projectId}`);
  return response.data;
};

/**
 * Archive a project.
 * PATCH /projects/:id/archive
 */
export const archiveProject = async (projectId: string): Promise<ArchiveProjectResponse> => {
  const response = await apiClient.patch<ArchiveProjectResponse>(
    `/projects/${projectId}/archive`,
  );
  return response.data;
};

/**
 * Get the processing pipeline status for a project.
 * GET /projects/:id/pipeline
 */
export const getProjectPipeline = async (projectId: string): Promise<GetProjectPipelineResponse> => {
  const response = await apiClient.get<GetProjectPipelineResponse>(
    `/projects/${projectId}/pipeline`,
  );
  return response.data;
};

/**
 * Update a project's title, description, or tech stack.
 * PATCH /projects/:id
 */
export const updateProject = async (
  projectId: string,
  data: { title?: string; description?: string; techStack?: string[] },
): Promise<UpdateProjectResponse> => {
  const response = await apiClient.patch<UpdateProjectResponse>(
    `/projects/${projectId}`,
    data,
  );
  return response.data;
};
