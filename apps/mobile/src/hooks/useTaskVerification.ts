import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskEvidencePayload, VerificationVerdictValue } from '@repo/types';
import { getTaskVerification } from '../lib/api/github';

export interface UseTaskVerificationResult {
  verdict: VerificationVerdictValue | null;
  summary: string | null;
  evidence: TaskEvidencePayload[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Verification for one task.
 *
 * Failures are deliberately silent: verification is supporting information on
 * a task screen, and an error banner for it would sit above the task's own
 * content implying something is wrong with the task itself. A task whose
 * verdict could not be loaded simply shows no verification section.
 */
export function useTaskVerification(
  projectId: string | undefined,
  taskId: string | undefined,
): UseTaskVerificationResult {
  const [verdict, setVerdict] = useState<VerificationVerdictValue | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<TaskEvidencePayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchVerification = useCallback(async () => {
    if (!projectId || !taskId) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await getTaskVerification(projectId, taskId);
      if (!mountedRef.current || !response.success) return;

      setVerdict(response.data.verdict);
      setSummary(response.data.summary);
      setEvidence(response.data.evidence);
    } catch (error) {
      console.error('[Verification] Fetch error:', error);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    void fetchVerification();
  }, [fetchVerification]);

  return { verdict, summary, evidence, isLoading, refresh: fetchVerification };
}
