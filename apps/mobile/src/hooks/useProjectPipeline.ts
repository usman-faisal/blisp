import { useState, useCallback, useEffect, useRef } from 'react';
import { getProjectPipeline } from '../lib/api/projects';
import type { PipelineEventPayload } from '@repo/types';

export interface ProjectPipeline {
  projectId: string;
  projectTitle: string;
  events: PipelineEventPayload[];
}

/**
 * Polls the pipeline status for a project every `intervalMs`.
 * Stops automatically once RESOURCE_FETCH_COMPLETED or DAILY_PLAN_COMPLETED is seen.
 */
export function useProjectPipeline(
  projectId: string | null,
  intervalMs = 3000,
) {
  const [data, setData] = useState<ProjectPipeline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isComplete = useCallback((events: PipelineEventPayload[]) => {
    const stages = new Set(events.map((e) => e.stage));
    return (
      stages.has('DAILY_PLAN_COMPLETED') ||
      stages.has('RESOURCE_FETCH_COMPLETED') ||
      stages.has('PLAN_COMPLETED')
    );
  }, []);

  const fetchPipeline = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await getProjectPipeline(projectId);
      if (response.success && response.data) {
        setData({
          projectId: response.data.projectId,
          projectTitle: response.data.projectTitle,
          events: response.data.events,
        });

        // Stop polling once pipeline is done
        if (isComplete(response.data.events) && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('[Pipeline] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, isComplete]);

  useEffect(() => {
    if (!projectId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    fetchPipeline();

    intervalRef.current = setInterval(fetchPipeline, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectId, intervalMs, fetchPipeline]);

  return { data, isLoading, isComplete: data ? isComplete(data.events) : false };
}
