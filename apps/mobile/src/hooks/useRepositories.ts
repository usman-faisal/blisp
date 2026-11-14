import { useCallback, useEffect, useRef, useState } from 'react';
import type { LinkedRepositoryPayload, SyncResultPayload, VerificationSummaryPayload } from '@repo/types';
import {
  getProjectVerification,
  linkRepository,
  listRepositories,
  syncRepository,
  unlinkRepository,
} from '../lib/api/github';

export interface UseRepositoriesResult {
  repositories: LinkedRepositoryPayload[];
  verification: VerificationSummaryPayload | null;
  lastSync: SyncResultPayload | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  link: (repository: string) => Promise<boolean>;
  sync: (repositoryId: string) => Promise<boolean>;
  unlink: (repositoryId: string) => Promise<void>;
}

/** A user-facing message from an axios-shaped error. */
function describeError(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message || fallback;
}

/**
 * Linked repositories and the project's verification totals.
 *
 * Fetched together because they move together: linking or syncing a repository
 * changes how many completions are backed by evidence, and showing one without
 * refreshing the other would leave contradictory numbers on the same screen.
 */
export function useRepositories(projectId: string | undefined): UseRepositoriesResult {
  const [repositories, setRepositories] = useState<LinkedRepositoryPayload[]>([]);
  const [verification, setVerification] = useState<VerificationSummaryPayload | null>(null);
  const [lastSync, setLastSync] = useState<SyncResultPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAll = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    try {
      const [repositoriesResponse, verificationResponse] = await Promise.all([
        listRepositories(projectId),
        getProjectVerification(projectId),
      ]);

      if (!mountedRef.current) return;
      if (repositoriesResponse.success) setRepositories(repositoriesResponse.data);
      if (verificationResponse.success) setVerification(verificationResponse.data);
    } catch (fetchError) {
      console.error('[Repositories] Fetch error:', fetchError);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const link = useCallback(
    async (repository: string) => {
      if (!projectId || isSaving) return false;

      setIsSaving(true);
      setError(null);
      try {
        await linkRepository(projectId, repository);
        await fetchAll();
        return true;
      } catch (linkError) {
        if (mountedRef.current) {
          setError(describeError(linkError, 'Could not link that repository.'));
        }
        return false;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [projectId, isSaving, fetchAll],
  );

  const sync = useCallback(
    async (repositoryId: string) => {
      if (!projectId || isSaving) return false;

      setIsSaving(true);
      setError(null);
      try {
        const response = await syncRepository(projectId, repositoryId);
        if (mountedRef.current && response.success) setLastSync(response.data);
        await fetchAll();
        return true;
      } catch (syncError) {
        if (mountedRef.current) {
          setError(describeError(syncError, 'Could not sync that repository.'));
        }
        return false;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [projectId, isSaving, fetchAll],
  );

  const unlink = useCallback(
    async (repositoryId: string) => {
      if (!projectId || isSaving) return;

      setIsSaving(true);
      setError(null);
      try {
        await unlinkRepository(projectId, repositoryId);
        // Every task is re-judged server-side when a repository goes away, so
        // the totals here are stale until refetched.
        setLastSync(null);
        await fetchAll();
      } catch (unlinkError) {
        if (mountedRef.current) {
          setError(describeError(unlinkError, 'Could not unlink that repository.'));
        }
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [projectId, isSaving, fetchAll],
  );

  return { repositories, verification, lastSync, isLoading, isSaving, error, refresh: fetchAll, link, sync, unlink };
}
