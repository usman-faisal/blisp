import { useState, useCallback, useEffect, useRef } from 'react';
import { getProjects } from '../lib/api/projects';

export interface Resource {
  id: string;
  title: string;
  summary: string;
  source: string;
}

export interface IncubatorProject {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  resources: Resource[];
}

const POLL_INTERVAL_MS = 5000;

export function useIncubatorProjects() {
  const [data, setData] = useState<IncubatorProject[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProjects = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await getProjects('INCUBATOR');
      if (response.success) {
        const mappedData: IncubatorProject[] = response.data.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          techStack: p.techStack || [],
          resources: p.resources ? p.resources.map(r => ({
            id: r.id,
            title: r.title,
            summary: r.summary || '',
            source: r.type || 'Source',
          })) : [],
        }));
        setData(mappedData);
      }
    } catch (error) {
      console.error('Error fetching incubator projects:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => fetchProjects(false), POLL_INTERVAL_MS);
  }, [fetchProjects]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchProjects(true);
    startPolling();
    return stopPolling;
  }, [fetchProjects, startPolling, stopPolling]);

  const mutate = useCallback(() => {
    fetchProjects(false);
  }, [fetchProjects]);

  return { data, isLoading, mutate, startPolling, stopPolling };
}
