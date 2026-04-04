import { apiClient } from './client';

export interface BrainDumpResponse {
  data: {
    id: string;
    rawTranscript: string;
    processedAt: string;
    projects: Array<{
      id: string;
      title: string;
      description: string;
      classification: string;
      status: string;
      techStack: string[];
      tasks: Array<{
        id: string;
        title: string;
        status: string;
      }>;
    }>;
  };
  message: string;
  success: boolean;
}

export const createBrainDump = async (prompt: string): Promise<BrainDumpResponse> => {
  const response = await apiClient.post<BrainDumpResponse>('/brain-dumps', { prompt });
  return response.data;
};
