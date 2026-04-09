import { useState, useCallback, useEffect, useRef } from 'react';
import { getProjects } from '../lib/api/projects';

export interface ActiveProject {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  classification: string;
  taskCounts: { todo: number; inProgress: number; done: number; total: number };
}

export function useActiveProjects() {
  const [data, setData] = useState<ActiveProject[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await getProjects('ACTIVE');
      if (response.success) {
        const mappedData: ActiveProject[] = response.data.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          techStack: p.techStack || [],
          classification: p.classification || '',
          taskCounts: p.taskCounts ?? { todo: 0, inProgress: 0, done: 0, total: 0 },
        }));
        setData(mappedData);
      }
    } catch (error) {
      console.error('Error fetching active projects:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects(true);
  }, [fetchProjects]);

  const mutate = useCallback(() => {
    return fetchProjects(false);
  }, [fetchProjects]);

  return { data, isLoading, mutate };
}
