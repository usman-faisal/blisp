import { apiClient } from './client';
import { BrainDumpResponse, ProgressUpdateResponse } from '@repo/types';

export const createBrainDump = async (prompt: string): Promise<BrainDumpResponse | ProgressUpdateResponse> => {
  const response = await apiClient.post<BrainDumpResponse | ProgressUpdateResponse>('/brain-dumps', { prompt });
  return response.data;
};
