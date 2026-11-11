import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  HistoryDayPayload,
  StreakPayload,
  MilestoneStatusValue,
  RoadmapResponsePayload,
  ScopeItemPayload,
  TodayResponsePayload,
} from '@repo/types';
import {
  deferTasks,
  generateRoadmap,
  getRoadmap,
  getRoadmapHistory,
  getSuggestedScope,
  getToday,
  restoreTask,
  setMilestoneStatus,
  updateRoadmapSettings,
} from '../lib/api/roadmap';

export interface UseRoadmapResult {
  roadmap: RoadmapResponsePayload | null;
  today: TodayResponsePayload | null;
  history: HistoryDayPayload[];
  streak: StreakPayload | null;
  isLoading: boolean;
  isSaving: boolean;
  actionError: string | null;
  refresh: () => Promise<void>;
  saveSettings: (settings: {
    deadline?: string | null;
    hoursPerDay?: number | null;
    workingDays?: number[];
    skillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null;
  }) => Promise<void>;
  build: (scope: ScopeItemPayload[]) => Promise<boolean>;
  loadSuggestedScope: () => Promise<{ fromReportVersion: number | null; scope: ScopeItemPayload[] }>;
  defer: (taskIds: string[]) => Promise<void>;
  restore: (taskId: string) => Promise<void>;
  updateMilestone: (milestoneId: string, status: MilestoneStatusValue) => Promise<void>;
}

/** A user-facing message from an axios-shaped error, without leaking internals. */
function describeError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: { message?: string } } })?.response;

  if (response?.status === 404) {
    return 'That project is no longer available.';
  }
  if (response?.data?.message) {
    return response.data.message;
  }
  return fallback;
}

/**
 * Loads a project's roadmap, today's plan and recent history together.
 *
 * All three in one hook because the screens show them side by side and the
 * figures have to agree: completing a task changes today's completion, the
 * milestone's progress and the project total at once, so they are refetched
 * together rather than drifting apart.
 */
export function useRoadmap(projectId: string | undefined): UseRoadmapResult {
  const [roadmap, setRoadmap] = useState<RoadmapResponsePayload | null>(null);
  const [today, setToday] = useState<TodayResponsePayload | null>(null);
  const [history, setHistory] = useState<HistoryDayPayload[]>([]);
  const [streak, setStreak] = useState<StreakPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Guards setState after unmount, since every fetch here is async. */
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAll = useCallback(
    async (showLoading = false) => {
      if (!projectId) return;
      if (showLoading) setIsLoading(true);

      try {
        // Together, so the roadmap total and today's figures cannot disagree.
        const [roadmapRes, todayRes, historyRes] = await Promise.all([
          getRoadmap(projectId),
          getToday(projectId),
          getRoadmapHistory(projectId, 7),
        ]);

        if (!mountedRef.current) return;

        if (roadmapRes.success) setRoadmap(roadmapRes.data);
        if (todayRes.success) setToday(todayRes.data);
        if (historyRes.success) {
          setHistory(historyRes.data.days);
          setStreak(historyRes.data.streak);
        }
      } catch (error) {
        console.error('[Roadmap] Fetch error:', error);
      } finally {
        if (mountedRef.current && showLoading) setIsLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!projectId) {
      setRoadmap(null);
      setToday(null);
      setIsLoading(false);
      return;
    }
    void fetchAll(true);
  }, [projectId, fetchAll]);

  const refresh = useCallback(async () => {
    await fetchAll(false);
  }, [fetchAll]);

  /** Wraps a mutation: one in-flight at a time, errors surfaced, then refetch. */
  const mutate = useCallback(
    async (action: () => Promise<void>, fallbackMessage: string): Promise<boolean> => {
      if (isSaving) return false;

      setIsSaving(true);
      setActionError(null);

      try {
        await action();
        await fetchAll(false);
        return true;
      } catch (error) {
        if (mountedRef.current) {
          setActionError(describeError(error, fallbackMessage));
        }
        return false;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [isSaving, fetchAll],
  );

  const saveSettings = useCallback<UseRoadmapResult['saveSettings']>(
    async (settings) => {
      if (!projectId) return;
      await mutate(async () => {
        await updateRoadmapSettings(projectId, settings);
      }, 'Could not save those settings.');
    },
    [projectId, mutate],
  );

  const build = useCallback(
    async (scope: ScopeItemPayload[]) => {
      if (!projectId) return false;
      return mutate(async () => {
        await generateRoadmap(projectId, scope);
      }, 'Could not build the roadmap.');
    },
    [projectId, mutate],
  );

  /**
   * Fetched on demand rather than with the roadmap: it is only needed when the
   * user opens the planning sheet, and it is not part of the roadmap itself.
   */
  const loadSuggestedScope = useCallback(async () => {
    if (!projectId) return { fromReportVersion: null, scope: [] };

    try {
      const response = await getSuggestedScope(projectId);
      return response.success ? response.data : { fromReportVersion: null, scope: [] };
    } catch (error) {
      console.error('[Roadmap] Suggested scope error:', error);
      // Not fatal: the user can still type their own scope.
      return { fromReportVersion: null, scope: [] };
    }
  }, [projectId]);

  const defer = useCallback(
    async (taskIds: string[]) => {
      if (!projectId) return;
      await mutate(async () => {
        await deferTasks(projectId, taskIds);
      }, 'Could not defer those tasks.');
    },
    [projectId, mutate],
  );

  const restore = useCallback(
    async (taskId: string) => {
      if (!projectId) return;
      await mutate(async () => {
        await restoreTask(projectId, taskId);
      }, 'Could not restore that task.');
    },
    [projectId, mutate],
  );

  const updateMilestone = useCallback(
    async (milestoneId: string, status: MilestoneStatusValue) => {
      if (!projectId) return;
      await mutate(async () => {
        await setMilestoneStatus(projectId, milestoneId, status);
      }, 'Could not update that milestone.');
    },
    [projectId, mutate],
  );

  return {
    roadmap,
    today,
    history,
    streak,
    isLoading,
    isSaving,
    actionError,
    refresh,
    saveSettings,
    build,
    loadSuggestedScope,
    defer,
    restore,
    updateMilestone,
  };
}
