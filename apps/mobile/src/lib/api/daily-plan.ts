import { apiClient } from './client';
import { GetTodayPlanResponse } from '@repo/types';
/**
 * Get today's daily plan for the user.
 * GET /daily-plans/today
 */
export const getTodayPlan = async (): Promise<GetTodayPlanResponse> => {
  const response = await apiClient.get<GetTodayPlanResponse>('/daily-plans/today');
  return response.data;
};
