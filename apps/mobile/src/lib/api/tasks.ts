import { apiClient } from './client';
import { GetTaskDetailResponse, UpdateTaskStatusResponse } from '@repo/types';

/**
 * Get full task details including resources and project info.
 * GET /tasks/:id
 */
export const getTaskById = async (taskId: string): Promise<GetTaskDetailResponse> => {
  const response = await apiClient.get<GetTaskDetailResponse>(`/tasks/${taskId}`);
  return response.data;
};

/**
 * Update a task's status (TODO, IN_PROGRESS, DONE).
 * PATCH /tasks/:id/status
 */
export const updateTaskStatus = async (
  taskId: string,
  status: string,
): Promise<UpdateTaskStatusResponse> => {
  const response = await apiClient.patch<UpdateTaskStatusResponse>(
    `/tasks/${taskId}/status`,
    { status },
  );
  return response.data;
};
