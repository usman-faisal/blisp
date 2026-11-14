import { EvidenceSource, TaskStatus, VerificationVerdict } from '@repo/db';
import {
  CompletionClaim,
  EvidenceRecord,
  EVIDENCE_BACKDATE_GRACE_MS,
  summarizeVerification,
  verifyCompletion,
} from '../verification';

/**
 * The completion-verification rule.
 *
 * Worth testing heavily because this is the feature's whole claim: that BLISP
 * can tell a corroborated completion from an unchecked one. A wrong verdict
 * here is not a cosmetic bug — it either accuses a user of not doing work they
 * did, or vouches for work that was never done.
 */
describe('verifyCompletion', () => {
  const CREATED = new Date('2026-11-01T10:00:00Z');
  const COMPLETED = new Date('2026-11-05T17:00:00Z');

  function claim(overrides: Partial<CompletionClaim> = {}): CompletionClaim {
    return { id: 'task-1', status: TaskStatus.DONE, createdAt: CREATED, completedAt: COMPLETED, ...overrides };
  }

  function evidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
    return {
      source: EvidenceSource.COMMIT,
      externalId: 'a3f91c2',
      occurredAt: new Date('2026-11-04T12:00:00Z'),
      ...overrides,
    };
  }

  describe('when no repository is linked', () => {
    it('reports SELF_REPORTED rather than blaming the user', () => {
      // The distinction that matters: this project never could be checked, so
      // calling it UNVERIFIED would misrepresent a setup choice as a failure.
      const result = verifyCompletion(claim(), [], false);

      expect(result.verdict).toBe(VerificationVerdict.SELF_REPORTED);
      expect(result.summary).toContain('No repository linked');
    });

    it('still records when the completion was claimed', () => {
      expect(verifyCompletion(claim(), [], false).claimedAt).toEqual(COMPLETED);
    });
  });

  describe('when a repository is linked', () => {
    it('reports VERIFIED when a commit references the task', () => {
      const result = verifyCompletion(claim(), [evidence()], true);

      expect(result.verdict).toBe(VerificationVerdict.VERIFIED);
      expect(result.evidenceCount).toBe(1);
      expect(result.summary).toBe('1 commit references this task.');
    });

    it('reports UNVERIFIED when nothing was found', () => {
      const result = verifyCompletion(claim(), [], true);

      expect(result.verdict).toBe(VerificationVerdict.UNVERIFIED);
      // Phrased as a fact about the evidence, never as an accusation.
      expect(result.summary).toBe('No commit or pull request references this task.');
    });

    it('names what was found, so the user can judge the verdict', () => {
      const result = verifyCompletion(
        claim(),
        [evidence(), evidence({ externalId: 'b1', source: EvidenceSource.PULL_REQUEST })],
        true,
      );

      expect(result.summary).toBe('1 commit and 1 pull request reference this task.');
    });

    it('pluralises a single source correctly', () => {
      const result = verifyCompletion(claim(), [evidence(), evidence({ externalId: 'b2' })], true);

      expect(result.summary).toBe('2 commits reference this task.');
    });
  });

  describe('evidence that predates the task', () => {
    it('reports DISPUTED when ALL evidence is older than the task', () => {
      const stale = evidence({ occurredAt: new Date('2026-10-01T00:00:00Z') });

      const result = verifyCompletion(claim(), [stale], true);

      expect(result.verdict).toBe(VerificationVerdict.DISPUTED);
      expect(result.summary).toContain('predates the task');
    });

    it('still VERIFIES when only some evidence is stale', () => {
      // Partial staleness is normal: an old commit gets linked by hand
      // alongside the real work. The recent evidence stands on its own.
      const result = verifyCompletion(
        claim(),
        [evidence({ occurredAt: new Date('2026-09-01T00:00:00Z') }), evidence({ externalId: 'fresh' })],
        true,
      );

      expect(result.verdict).toBe(VerificationVerdict.VERIFIED);
      // Only the relevant evidence is counted.
      expect(result.evidenceCount).toBe(1);
    });

    it('allows evidence slightly older than the task', () => {
      // Writing code and then creating the task to track it is a legitimate
      // order of operations, and must not be reported as a contradiction.
      const justBefore = new Date(CREATED.getTime() - EVIDENCE_BACKDATE_GRACE_MS + 60_000);

      const result = verifyCompletion(claim(), [evidence({ occurredAt: justBefore })], true);

      expect(result.verdict).toBe(VerificationVerdict.VERIFIED);
    });

    it('rejects evidence just outside the grace period', () => {
      const justOutside = new Date(CREATED.getTime() - EVIDENCE_BACKDATE_GRACE_MS - 60_000);

      const result = verifyCompletion(claim(), [evidence({ occurredAt: justOutside })], true);

      expect(result.verdict).toBe(VerificationVerdict.DISPUTED);
    });
  });

  describe('tasks that are not done', () => {
    it.each([TaskStatus.TODO, TaskStatus.IN_PROGRESS])('makes no claim for %s', (status) => {
      const result = verifyCompletion(claim({ status, completedAt: null }), [], true);

      expect(result.claimedAt).toBeNull();
      expect(result.summary).toBe('Not marked done yet.');
    });

    it('notes evidence on an unfinished task without judging it', () => {
      // Commits against an in-progress task are normal, not a contradiction.
      const result = verifyCompletion(claim({ status: TaskStatus.IN_PROGRESS, completedAt: null }), [evidence()], true);

      expect(result.verdict).toBe(VerificationVerdict.UNVERIFIED);
      expect(result.summary).toContain('not marked done');
    });

    it('ignores a stale completedAt when the task is no longer done', () => {
      // A reopened task keeps its old completedAt until it is cleared; the
      // verdict must follow the current status, not the stale timestamp.
      const result = verifyCompletion(claim({ status: TaskStatus.TODO }), [evidence()], true);

      expect(result.claimedAt).toBeNull();
    });
  });
});

describe('summarizeVerification', () => {
  const v = (verdict: VerificationVerdict) => ({ verdict });

  it('reports null rather than 0% when nothing was checkable', () => {
    // A project with no repository scoring "0% verified" would read as a
    // failure when it is simply a different setup.
    const summary = summarizeVerification([v(VerificationVerdict.SELF_REPORTED), v(VerificationVerdict.SELF_REPORTED)]);

    expect(summary.percentVerified).toBeNull();
    expect(summary.selfReported).toBe(2);
  });

  it('excludes self-reported tasks from the ratio', () => {
    // 1 verified of 2 checkable = 50%, despite 3 completions in total.
    const summary = summarizeVerification([
      v(VerificationVerdict.VERIFIED),
      v(VerificationVerdict.UNVERIFIED),
      v(VerificationVerdict.SELF_REPORTED),
    ]);

    expect(summary.percentVerified).toBe(50);
    expect(summary.completed).toBe(3);
  });

  it('counts disputed against the ratio', () => {
    const summary = summarizeVerification([v(VerificationVerdict.VERIFIED), v(VerificationVerdict.DISPUTED)]);

    expect(summary.percentVerified).toBe(50);
    expect(summary.disputed).toBe(1);
  });

  it('handles an empty project', () => {
    expect(summarizeVerification([])).toEqual({
      completed: 0,
      verified: 0,
      unverified: 0,
      disputed: 0,
      selfReported: 0,
      percentVerified: null,
    });
  });

  it('reports 100 only when everything checkable passed', () => {
    const summary = summarizeVerification([v(VerificationVerdict.VERIFIED), v(VerificationVerdict.VERIFIED)]);

    expect(summary.percentVerified).toBe(100);
  });
});
