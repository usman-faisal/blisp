import { EvidenceSource, TaskStatus, VerificationVerdict } from '@repo/db';

/**
 * Deciding whether a completion claim is corroborated.
 *
 * The problem this solves: task status is self-reported. A user taps "Done"
 * and every downstream figure — milestone progress, streaks, schedule fit —
 * treats that as fact. Nothing checks it.
 *
 * The approach mirrors the discovery report's entailment pass, deliberately.
 * There, a claim is checked against retrieved evidence and may come back
 * SUPPORTED, NOT_SUPPORTED or CONTRADICTED; the honest answer is often "we
 * cannot tell", and collapsing that into a boolean would misrepresent it.
 * The same is true here, so the verdicts are shaped the same way.
 *
 * What this is NOT: a judgement of the person. UNVERIFIED is not an accusation
 * — writing documentation, sketching a design or pairing on someone else's
 * branch all produce real work and no matching commit. The UI must present it
 * as "we could not check this", never as "you did not do this".
 *
 * Everything here is pure: no database, no network. The service supplies rows
 * and persists the result, which keeps the rule itself trivially testable.
 */

/** A task's completion claim, as stored. */
export interface CompletionClaim {
  id: string;
  status: TaskStatus;
  /** When the task was created; evidence older than this cannot support it. */
  createdAt: Date;
  /** When it was last marked DONE. Null when it is not done. */
  completedAt: Date | null;
}

/** One observed artifact, already matched to the task. */
export interface EvidenceRecord {
  source: EvidenceSource;
  externalId: string;
  occurredAt: Date;
  authorLogin?: string | null;
}

export interface VerificationOutcome {
  verdict: VerificationVerdict;
  evidenceCount: number;
  /** One sentence in the user's terms. Shown verbatim in the UI. */
  summary: string;
  claimedAt: Date | null;
}

/**
 * Grace period for evidence that slightly predates the task.
 *
 * Real sequences are messier than the data model: someone writes the code,
 * then creates the task to track what they just did. Without this, that
 * entirely legitimate order is reported as DISPUTED, which would train users
 * to distrust the verdict — the fastest way to make the whole feature
 * worthless.
 */
export const EVIDENCE_BACKDATE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Judges one completion claim against the evidence found for it.
 *
 * @param claim the task and its claimed completion
 * @param evidence artifacts matched to this task, in any order
 * @param hasRepository whether the project has a repository linked at all —
 *   this is what separates "nothing found" from "nothing could be found"
 */
export function verifyCompletion(
  claim: CompletionClaim,
  evidence: readonly EvidenceRecord[],
  hasRepository: boolean,
): VerificationOutcome {
  const claimedAt = claim.status === TaskStatus.DONE ? claim.completedAt : null;

  // Only a DONE task makes a claim worth checking. An in-progress task with
  // commits against it is normal, not evidence of anything to judge.
  if (claim.status !== TaskStatus.DONE) {
    return {
      verdict: hasRepository ? VerificationVerdict.UNVERIFIED : VerificationVerdict.SELF_REPORTED,
      evidenceCount: evidence.length,
      summary:
        evidence.length > 0
          ? `${describeCount(evidence.length)} linked, but this task is not marked done.`
          : 'Not marked done yet.',
      claimedAt: null,
    };
  }

  // No repository means verification was never possible. Reporting that as
  // UNVERIFIED would blame a user for not connecting GitHub, and would make
  // every project without it look like it was failing checks.
  if (!hasRepository) {
    return {
      verdict: VerificationVerdict.SELF_REPORTED,
      evidenceCount: 0,
      summary: 'No repository linked, so this completion could not be checked.',
      claimedAt,
    };
  }

  if (evidence.length === 0) {
    return {
      verdict: VerificationVerdict.UNVERIFIED,
      evidenceCount: 0,
      summary: 'No commit or pull request references this task.',
      claimedAt,
    };
  }

  // Evidence that predates the task by more than the grace period cannot be
  // about work done for it. If ALL of it is stale, the claim is contradicted;
  // if only some is, the recent evidence stands on its own.
  const cutoff = new Date(claim.createdAt.getTime() - EVIDENCE_BACKDATE_GRACE_MS);
  const relevant = evidence.filter((item) => item.occurredAt >= cutoff);

  if (relevant.length === 0) {
    return {
      verdict: VerificationVerdict.DISPUTED,
      evidenceCount: evidence.length,
      summary: `${describeCount(evidence.length)} linked, but all of it predates the task.`,
      claimedAt,
    };
  }

  return {
    verdict: VerificationVerdict.VERIFIED,
    evidenceCount: relevant.length,
    summary: summarizeEvidence(relevant),
    claimedAt,
  };
}

/** "1 commit" / "3 commits" / "2 items" when the sources are mixed. */
function describeCount(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
}

/**
 * A sentence naming what was actually found.
 *
 * Specific on purpose: "2 commits reference this task" lets a user judge the
 * verdict, where a bare "Verified" asks them to trust it.
 */
function summarizeEvidence(evidence: readonly EvidenceRecord[]): string {
  const counts = new Map<EvidenceSource, number>();
  for (const item of evidence) {
    counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
  }

  const labels: { source: EvidenceSource; one: string; many: string }[] = [
    { source: EvidenceSource.COMMIT, one: 'commit', many: 'commits' },
    { source: EvidenceSource.PULL_REQUEST, one: 'pull request', many: 'pull requests' },
    { source: EvidenceSource.ISSUE, one: 'issue', many: 'issues' },
    { source: EvidenceSource.MANUAL, one: 'manual link', many: 'manual links' },
  ];

  const parts = labels
    .filter(({ source }) => (counts.get(source) ?? 0) > 0)
    .map(({ source, one, many }) => {
      const count = counts.get(source) ?? 0;
      return `${count} ${count === 1 ? one : many}`;
    });

  const subject = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  const verb = evidence.length === 1 ? 'references' : 'reference';

  return `${subject} ${verb} this task.`;
}

/** Project-wide verification totals, for the honest line under progress. */
export interface VerificationSummary {
  /** Tasks marked DONE. The denominator for everything below. */
  completed: number;
  verified: number;
  unverified: number;
  disputed: number;
  selfReported: number;
  /**
   * Percentage of completions backed by evidence, 0–100.
   *
   * Null when nothing is verifiable at all (no repository linked), because a
   * project with no GitHub connection scoring 0% would read as a failure when
   * it is simply a different setup.
   */
  percentVerified: number | null;
}

export function summarizeVerification(verdicts: readonly { verdict: VerificationVerdict }[]): VerificationSummary {
  const count = (target: VerificationVerdict) => verdicts.filter((v) => v.verdict === target).length;

  const verified = count(VerificationVerdict.VERIFIED);
  const unverified = count(VerificationVerdict.UNVERIFIED);
  const disputed = count(VerificationVerdict.DISPUTED);
  const selfReported = count(VerificationVerdict.SELF_REPORTED);
  const completed = verdicts.length;

  // Self-reported tasks are excluded from the ratio rather than counted as
  // failures: they were never checkable, so including them would punish a
  // project for not linking a repository.
  const checkable = verified + unverified + disputed;

  return {
    completed,
    verified,
    unverified,
    disputed,
    selfReported,
    percentVerified: checkable === 0 ? null : Math.round((verified / checkable) * 100),
  };
}
