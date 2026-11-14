import { CommitLike, closedIssueNumbers, matchCommit, taskReference } from '../matcher';

/**
 * Commit-to-task matching.
 *
 * The bias under test throughout: a false positive is worse than a miss.
 * Crediting an unrelated commit makes every badge untrustworthy, while a miss
 * only yields an UNVERIFIED badge the UI already presents without blame.
 */
describe('taskReference', () => {
  it('is short enough to type into a commit message', () => {
    const reference = taskReference('4f2a1c08-9b3d-4e5f-a1b2-c3d4e5f60718');

    expect(reference).toBe('BLISP-4f2a1c08');
    expect(reference.length).toBeLessThanOrEqual(14);
  });

  it('is stable for the same task', () => {
    const id = '4f2a1c08-9b3d-4e5f-a1b2-c3d4e5f60718';
    expect(taskReference(id)).toBe(taskReference(id));
  });

  it('differs between tasks that share a prefix after hyphen removal', () => {
    expect(taskReference('4f2a1c08-0000-0000-0000-000000000000')).not.toBe(
      taskReference('4f2a1c09-0000-0000-0000-000000000000'),
    );
  });
});

describe('matchCommit', () => {
  const TASK_A = { id: '4f2a1c08-9b3d-4e5f-a1b2-c3d4e5f60718', title: 'Implement booking endpoint' };
  const TASK_B = { id: 'aabbccdd-1111-2222-3333-444444444444', title: 'Set up message queue' };

  function commit(message: string): CommitLike {
    return {
      sha: 'a3f91c2',
      message,
      url: 'https://github.com/o/r/commit/a3f91c2',
      occurredAt: new Date('2026-11-04T12:00:00Z'),
    };
  }

  it('matches an explicit reference', () => {
    const matches = matchCommit(commit('BLISP-4f2a1c08 add booking endpoint'), [TASK_A, TASK_B]);

    expect(matches).toHaveLength(1);
    expect(matches[0].taskId).toBe(TASK_A.id);
  });

  it("explains why it matched, in the user's terms", () => {
    const matches = matchCommit(commit('BLISP-4f2a1c08 add booking endpoint'), [TASK_A]);

    expect(matches[0].reason).toBe('Commit message contains BLISP-4f2a1c08');
  });

  it('is case-insensitive, since users type lowercase', () => {
    expect(matchCommit(commit('blisp-4f2a1c08 fix'), [TASK_A])).toHaveLength(1);
  });

  it('matches a reference anywhere in the message', () => {
    expect(matchCommit(commit('fix the thing\n\nRefs BLISP-4f2a1c08'), [TASK_A])).toHaveLength(1);
  });

  it('returns every task a commit references', () => {
    // One commit legitimately closes several tasks; picking one would discard
    // real evidence.
    const matches = matchCommit(commit('BLISP-4f2a1c08 BLISP-aabbccdd done both'), [TASK_A, TASK_B]);

    expect(matches.map((m) => m.taskId).sort()).toEqual([TASK_A.id, TASK_B.id].sort());
  });

  describe('does NOT match on resemblance', () => {
    it('ignores a commit whose words overlap the task title', () => {
      // The critical case. "Implement booking endpoint" shares every
      // significant word, and crediting it would be exactly the kind of
      // plausible-but-wrong attribution that makes verification worthless.
      expect(matchCommit(commit('implement booking endpoint'), [TASK_A])).toHaveLength(0);
    });

    it('ignores an unrelated commit made the same day', () => {
      expect(matchCommit(commit('bump dependencies'), [TASK_A])).toHaveLength(0);
    });

    it('ignores a bare uuid prefix without the BLISP- marker', () => {
      // Requiring the marker avoids matching a hex string that happens to
      // appear in a diff, a filename or another sha.
      expect(matchCommit(commit('4f2a1c08 some change'), [TASK_A])).toHaveLength(0);
    });

    it('ignores an empty message', () => {
      expect(matchCommit(commit(''), [TASK_A])).toHaveLength(0);
    });

    it('returns nothing when the project has no tasks', () => {
      expect(matchCommit(commit('BLISP-4f2a1c08'), [])).toHaveLength(0);
    });
  });
});

describe('closedIssueNumbers', () => {
  it.each([
    ['closes #12', [12]],
    ['Closed #12', [12]],
    ['fix #7', [7]],
    ['fixes #7', [7]],
    ['fixed #7', [7]],
    ['resolve #3', [3]],
    ['resolves #3', [3]],
  ])('recognises GitHub closing keyword %s', (message, expected) => {
    expect(closedIssueNumbers(message)).toEqual(expected);
  });

  it('finds several in one message', () => {
    expect(closedIssueNumbers('closes #1 and fixes #2').sort()).toEqual([1, 2]);
  });

  it('de-duplicates repeats', () => {
    expect(closedIssueNumbers('closes #5, closes #5')).toEqual([5]);
  });

  it('ignores a bare mention', () => {
    // "#12" is discussion, not a claim of completion. Treating the two alike
    // would over-credit conversation as work.
    expect(closedIssueNumbers('related to #12')).toEqual([]);
  });

  it('ignores a keyword with no number', () => {
    expect(closedIssueNumbers('closes the loop')).toEqual([]);
  });

  it('ignores issue zero', () => {
    expect(closedIssueNumbers('closes #0')).toEqual([]);
  });
});

/**
 * The reference format is duplicated in the mobile client
 * (apps/mobile/src/lib/api/github.ts). The app shows this string and the
 * server looks for it, so a silent divergence would mean nothing ever
 * verifies while both sides look correct.
 *
 * This pins the exact output so a change here fails loudly rather than
 * quietly breaking the feature.
 */
describe('reference format contract', () => {
  it('is BLISP- followed by 8 hex characters', () => {
    expect(taskReference('4f2a1c08-9b3d-4e5f-a1b2-c3d4e5f60718')).toBe('BLISP-4f2a1c08');
    expect(taskReference('aabbccdd-1111-2222-3333-444444444444')).toBe('BLISP-aabbccdd');
  });

  it('matches the mobile implementation exactly', () => {
    // Literal copy of apps/mobile/src/lib/api/github.ts. If this drifts, the
    // app would display a reference the server never looks for.
    const mobileImplementation = (taskId: string) => `BLISP-${taskId.replace(/-/g, '').slice(0, 8)}`;

    for (const id of [
      '4f2a1c08-9b3d-4e5f-a1b2-c3d4e5f60718',
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    ]) {
      expect(taskReference(id)).toBe(mobileImplementation(id));
    }
  });
});
