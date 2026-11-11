import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResearchReportPayload, ResearchReportVersionPayload } from '@repo/types';
import {
  approveResearchReport,
  cancelResearchReport,
  rejectResearchReport,
  getLatestResearchReport,
  getResearchReportVersion,
  getResearchReportVersions,
  requestResearchReport,
} from '../lib/api/research';

/** Milliseconds between polls while a report is PENDING. */
const POLL_INTERVAL_MS = 4000;

/**
 * Generation takes 60-100 seconds, so a request that still has not resolved
 * after this long is almost certainly a job that died without writing FAILED.
 * Without this the screen would spin forever on a dead worker.
 */
const POLL_TIMEOUT_MS = 4 * 60 * 1000;

export interface UseResearchReportResult {
  /** The report currently being displayed — latest, or the selected version. */
  report: ResearchReportPayload | null;
  versions: ResearchReportVersionPayload[];
  /** The version being shown; null means "follow the latest". */
  selectedVersion: number | null;
  isLoading: boolean;
  /** True while a POST is in flight, distinct from the report being PENDING. */
  isRequesting: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  isCancelling: boolean;
  /** Set when a request/approve call failed — not when the report itself did. */
  actionError: string | null;
  /** True once polling gave up; see POLL_TIMEOUT_MS. */
  timedOut: boolean;
  generate: () => Promise<void>;
  approve: (version: number) => Promise<void>;
  reject: (version: number, reason?: string) => Promise<void>;
  cancel: (version: number) => Promise<void>;
  selectVersion: (version: number | null) => void;
  refresh: () => Promise<void>;
}

/** Message for the user from an axios-shaped error, without leaking internals. */
function describeError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: { message?: string } } })
    ?.response;

  if (response?.status === 409) {
    return 'A report is already being generated for this project.';
  }
  if (response?.status === 403) {
    return 'You do not have access to this project.';
  }
  if (response?.data?.message) {
    return response.data.message;
  }
  return fallback;
}

/**
 * Loads a project's discovery report and drives generation.
 *
 * Polls only while the displayed report is PENDING, and only when following the
 * latest version — an older version is immutable, so polling it would be pure
 * waste. Matches the imperative-fetch style of useProjectDetail rather than
 * introducing React Query for one screen.
 */
export function useResearchReport(projectId: string | undefined): UseResearchReportResult {
  const [report, setReport] = useState<ResearchReportPayload | null>(null);
  const [versions, setVersions] = useState<ResearchReportVersionPayload[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);
  /** Guards setState after unmount, since every fetch here is async. */
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    pollStartedAtRef.current = null;
  }, []);

  const fetchVersions = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await getResearchReportVersions(projectId);
      if (mountedRef.current && response.success) {
        setVersions(response.data);
      }
    } catch (error) {
      // Non-fatal: the version switcher degrades to hidden, the report still shows.
      console.error('[ResearchReport] Versions fetch error:', error);
    }
  }, [projectId]);

  const fetchReport = useCallback(
    async (showLoading = false) => {
      if (!projectId) return;
      if (showLoading) setIsLoading(true);

      try {
        const response =
          selectedVersion === null
            ? await getLatestResearchReport(projectId)
            : await getResearchReportVersion(projectId, selectedVersion);

        if (mountedRef.current && response.success) {
          setReport(response.data);
        }
      } catch (error) {
        console.error('[ResearchReport] Fetch error:', error);
      } finally {
        if (mountedRef.current && showLoading) setIsLoading(false);
      }
    },
    [projectId, selectedVersion],
  );

  // Initial load, and a reload whenever the selected version changes.
  useEffect(() => {
    if (!projectId) {
      setReport(null);
      setVersions([]);
      setIsLoading(false);
      return;
    }
    setTimedOut(false);
    void fetchReport(true);
    void fetchVersions();
  }, [projectId, fetchReport, fetchVersions]);

  // Poll while PENDING. Driven off the report's own status rather than a
  // separate flag, so a report left PENDING from a previous session also polls.
  useEffect(() => {
    const shouldPoll = selectedVersion === null && report?.status === 'PENDING' && !timedOut;

    if (!shouldPoll) {
      stopPolling();
      return;
    }

    if (intervalRef.current) return;

    pollStartedAtRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const startedAt = pollStartedAtRef.current;
      if (startedAt && Date.now() - startedAt > POLL_TIMEOUT_MS) {
        stopPolling();
        if (mountedRef.current) setTimedOut(true);
        return;
      }
      void fetchReport(false);
      void fetchVersions();
    }, POLL_INTERVAL_MS);

    return stopPolling;
  }, [report?.status, selectedVersion, timedOut, fetchReport, fetchVersions, stopPolling]);

  const generate = useCallback(async () => {
    if (!projectId || isRequesting) return;

    setIsRequesting(true);
    setActionError(null);
    setTimedOut(false);

    try {
      const response = await requestResearchReport(projectId);

      // Snap back to following the latest, or a new version would generate
      // while the screen stayed pinned to an old one.
      setSelectedVersion(null);

      if (mountedRef.current && response.success) {
        // Optimistic: show PENDING immediately so the empty state does not
        // linger for a whole poll cycle. The next fetch replaces this with the
        // real row. A brand-new version has no sections by definition, so there
        // is nothing from the previous report worth preserving here.
        const now = new Date().toISOString();
        setReport({
          id: response.data.id,
          projectId,
          version: response.data.version,
          status: response.data.status,
          sections: null,
          sources: null,
          verification: null,
          researchedAt: null,
          model: null,
          error: null,
          rejectionReason: null,
          createdAt: now,
          updatedAt: now,
        });
      }

      await fetchVersions();
    } catch (error) {
      if (mountedRef.current) {
        setActionError(describeError(error, 'Could not start the report. Please try again.'));
      }
      // A 409 means one is genuinely running — pick it up rather than leaving
      // the screen on an error with no report in sight.
      await fetchReport(false);
    } finally {
      if (mountedRef.current) setIsRequesting(false);
    }
  }, [projectId, isRequesting, fetchReport, fetchVersions]);

  const approve = useCallback(
    async (version: number) => {
      if (!projectId || isApproving) return;

      setIsApproving(true);
      setActionError(null);

      try {
        await approveResearchReport(projectId, version);
        // Both: approving demotes any prior APPROVED, so the whole list moves.
        await Promise.all([fetchReport(false), fetchVersions()]);
      } catch (error) {
        if (mountedRef.current) {
          setActionError(describeError(error, 'Could not approve this report.'));
        }
      } finally {
        if (mountedRef.current) setIsApproving(false);
      }
    },
    [projectId, isApproving, fetchReport, fetchVersions],
  );

  const reject = useCallback(
    async (version: number, reason?: string) => {
      if (!projectId || isRejecting) return;

      setIsRejecting(true);
      setActionError(null);

      try {
        await rejectResearchReport(projectId, version, reason);
        // Both: the status badge and the version chip must agree.
        await Promise.all([fetchReport(false), fetchVersions()]);
      } catch (error) {
        if (mountedRef.current) {
          setActionError(describeError(error, 'Could not reject this report.'));
        }
      } finally {
        if (mountedRef.current) setIsRejecting(false);
      }
    },
    [projectId, isRejecting, fetchReport, fetchVersions],
  );

  const cancel = useCallback(
    async (version: number) => {
      if (!projectId || isCancelling) return;

      setIsCancelling(true);
      setActionError(null);
      // Stop the poll timer from racing the cancel: the timeout flag would
      // otherwise fire later and show a failure for something the user chose.
      setTimedOut(false);

      try {
        await cancelResearchReport(projectId, version);
        await Promise.all([fetchReport(false), fetchVersions()]);
      } catch (error) {
        if (mountedRef.current) {
          setActionError(describeError(error, 'Could not cancel this report.'));
        }
        // It may have finished in the meantime — show whatever the truth is.
        await fetchReport(false);
      } finally {
        if (mountedRef.current) setIsCancelling(false);
      }
    },
    [projectId, isCancelling, fetchReport, fetchVersions],
  );

  const selectVersion = useCallback((version: number | null) => {
    setActionError(null);
    setSelectedVersion(version);
  }, []);

  const refresh = useCallback(async () => {
    setTimedOut(false);
    await Promise.all([fetchReport(false), fetchVersions()]);
  }, [fetchReport, fetchVersions]);

  return {
    report,
    versions,
    selectedVersion,
    isLoading,
    isRequesting,
    isApproving,
    isRejecting,
    isCancelling,
    actionError,
    timedOut,
    generate,
    approve,
    reject,
    cancel,
    selectVersion,
    refresh,
  };
}
