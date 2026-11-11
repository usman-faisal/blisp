import { apiClient } from './client';
import type {
  DeferTasksResponse,
  GenerateRoadmapResponse,
  GetRoadmapHistoryResponse,
  GetRoadmapResponse,
  GetSuggestedScopeResponse,
  GetTodayResponse,
  MilestoneStatusValue,
  RestoreTaskResponse,
  ScopeItemPayload,
  SetMilestoneStatusResponse,
  UpdateRoadmapSettingsResponse,
} from '@repo/types';

/**
 * The whole roadmap in one call: milestones, progress at every level, and the
 * schedule assessment.
 *
 * One request rather than several because the figures must agree with each
 * other — fetching milestone and project progress separately would let them
 * disagree mid-update.
 * GET /projects/:projectId/roadmap
 */
export const getRoadmap = async (projectId: string): Promise<GetRoadmapResponse> => {
  const response = await apiClient.get<GetRoadmapResponse>(`/projects/${projectId}/roadmap`);
  return response.data;
};

/**
 * Today's planned tasks. `daily` is null when nothing is planned.
 * GET /projects/:projectId/roadmap/today
 */
export const getToday = async (projectId: string): Promise<GetTodayResponse> => {
  const response = await apiClient.get<GetTodayResponse>(`/projects/${projectId}/roadmap/today`);
  return response.data;
};

/**
 * Completion history, one entry per day including empty days.
 * GET /projects/:projectId/roadmap/history
 */
export const getRoadmapHistory = async (
  projectId: string,
  days = 7,
): Promise<GetRoadmapHistoryResponse> => {
  const response = await apiClient.get<GetRoadmapHistoryResponse>(
    `/projects/${projectId}/roadmap/history`,
    { params: { days } },
  );
  return response.data;
};

/**
 * Scope suggested from the project's approved discovery report.
 *
 * `scope` is empty when no report is approved — the user can still plan by
 * entering their own scope.
 * GET /projects/:projectId/roadmap/suggested-scope
 */
export const getSuggestedScope = async (projectId: string): Promise<GetSuggestedScopeResponse> => {
  const response = await apiClient.get<GetSuggestedScopeResponse>(
    `/projects/${projectId}/roadmap/suggested-scope`,
  );
  return response.data;
};

/**
 * Build the roadmap from the scope the user confirmed.
 *
 * Sends the scope in full rather than a report reference, so the roadmap is
 * built from what the user approved on screen.
 * POST /projects/:projectId/roadmap/generate
 */
export const generateRoadmap = async (
  projectId: string,
  scope: ScopeItemPayload[],
): Promise<GenerateRoadmapResponse> => {
  const response = await apiClient.post<GenerateRoadmapResponse>(
    `/projects/${projectId}/roadmap/generate`,
    { scope },
  );
  return response.data;
};

/**
 * Save deadline, hours per day, working days and skill level.
 * PATCH /projects/:projectId/roadmap/settings
 */
export const updateRoadmapSettings = async (
  projectId: string,
  settings: {
    deadline?: string | null;
    hoursPerDay?: number | null;
    workingDays?: number[];
    skillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null;
  },
): Promise<UpdateRoadmapSettingsResponse> => {
  const response = await apiClient.patch<UpdateRoadmapSettingsResponse>(
    `/projects/${projectId}/roadmap/settings`,
    settings,
  );
  return response.data;
};

/**
 * Defer tasks to shrink scope.
 *
 * Takes the exact ids from the confirmation preview, so what the user saw is
 * what is applied. Refuses completed work.
 * POST /projects/:projectId/roadmap/defer
 */
export const deferTasks = async (projectId: string, taskIds: string[]): Promise<DeferTasksResponse> => {
  const response = await apiClient.post<DeferTasksResponse>(`/projects/${projectId}/roadmap/defer`, {
    taskIds,
  });
  return response.data;
};

/**
 * Bring a deferred or cancelled task back into scope.
 * POST /projects/:projectId/roadmap/tasks/:taskId/restore
 */
export const restoreTask = async (projectId: string, taskId: string): Promise<RestoreTaskResponse> => {
  const response = await apiClient.post<RestoreTaskResponse>(
    `/projects/${projectId}/roadmap/tasks/${taskId}/restore`,
  );
  return response.data;
};

/**
 * PATCH /projects/:projectId/roadmap/milestones/:milestoneId
 */
export const setMilestoneStatus = async (
  projectId: string,
  milestoneId: string,
  status: MilestoneStatusValue,
): Promise<SetMilestoneStatusResponse> => {
  const response = await apiClient.patch<SetMilestoneStatusResponse>(
    `/projects/${projectId}/roadmap/milestones/${milestoneId}`,
    { status },
  );
  return response.data;
};
