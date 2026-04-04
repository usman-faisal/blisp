import { useState, useCallback, useEffect } from 'react';
import { getTodayPlan } from '../lib/api/daily-plan';

export interface DailyTask {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface DailyPlan {
  summary: string;
  tasks: DailyTask[];
}

const MOCK_DAILY_PLAN: DailyPlan = {
  summary:
    `Good morning! Today you have 3 high-priority items. The registration flow needs final QA, the admin panel user-flow is ready for design review, and there's a new dashboard ticket from the backlog. I've ordered them by impact.`,
  tasks: [
    {
      id: '1',
      title: 'Web application user registration process',
      status: 'in_progress',
    },
    {
      id: '2',
      title: 'User flow admin panel',
      status: 'pending',
    },
    {
      id: '3',
      title: 'Dashboard design for admin panel',
      status: 'pending',
    },
  ],
};

/**
 * Mock hook — mirrors React Query's { data, isLoading, mutate } shape.
 * Swap the body for a real `useQuery` call when the endpoint is ready.
 */
export function useDailyPlan() {
  const [data, setData] = useState<DailyPlan | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getTodayPlan();
      if (response.success && response.data) {
        const payload = response.data;
        const mappedTasks = (payload.tasks || []).map(t => {
          let mappedStatus: 'pending' | 'in_progress' | 'completed' = 'pending';
          if (t.status === 'IN_PROGRESS') mappedStatus = 'in_progress';
          if (t.status === 'DONE') mappedStatus = 'completed';

          return {
            id: t.id,
            title: t.title,
            status: mappedStatus,
          };
        });

        setData({
          summary: payload.summary || "Here is your plan for today.",
          tasks: mappedTasks,
        });
      } else {
        // No daily plan found or data is null
        setData(undefined);
      }
    } catch (error) {
      console.error('Error fetching today plan:', error);
      // Fallback for UI if error occurs could maintain MOCK or leave undefined
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  /** Call mutate() to re-fetch the daily plan (e.g. after a brain-dump). */
  const mutate = useCallback(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { data, isLoading, mutate };
}
