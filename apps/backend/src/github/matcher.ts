/**
 * Matching commits to tasks.
 *
 * The hard constraint: a false positive is far worse than a miss. If BLISP
 * marks a task VERIFIED on a commit that had nothing to do with it, the whole
 * feature becomes theatre — worse than not verifying at all, because it looks
 * authoritative. A missed match only costs an UNVERIFIED badge, which is an
 * honest outcome the UI already presents without blame.
 *
 * So matching is explicit-reference only. There is no fuzzy title similarity,
 * no "same day as the completion" heuristic, no keyword overlap. Those sound
 * helpful and are exactly how you end up attributing a README typo fix to
 * "Implement payment gateway".
 */

/** A commit as fetched from GitHub, reduced to what matching needs. */
export interface CommitLike {
  sha: string;
  message: string;
  url: string;
  authorLogin?: string | null;
  occurredAt: Date;
}

export interface TaskLike {
  id: string;
  title: string;
}

export interface CommitMatch {
  taskId: string;
  /** Plain-language reason, stored on the evidence row and shown to the user. */
  reason: string;
}

/**
 * The short reference users put in commit messages.
 *
 * A UUID is unusable here — nobody types 36 characters into a commit message.
 * The first 8 characters of the task id are short enough to type and specific
 * enough that an accidental collision inside one project is implausible.
 */
export const TASK_REF_LENGTH = 8;

/** The token users write, e.g. "BLISP-4f2a1c08". Case-insensitive in use. */
export function taskReference(taskId: string): string {
  return `BLISP-${taskId.replace(/-/g, '').slice(0, TASK_REF_LENGTH)}`;
}

/**
 * Matches one commit against the project's tasks.
 *
 * Returns every task the commit explicitly references: one commit legitimately
 * closes several tasks, and silently picking one would lose evidence.
 */
export function matchCommit(commit: CommitLike, tasks: readonly TaskLike[]): CommitMatch[] {
  const message = commit.message.toLowerCase();
  const matches: CommitMatch[] = [];

  for (const task of tasks) {
    const reference = taskReference(task.id).toLowerCase();

    if (message.includes(reference)) {
      matches.push({
        taskId: task.id,
        reason: `Commit message contains ${taskReference(task.id)}`,
      });
    }
  }

  return matches;
}

/**
 * Extracts the issue/PR numbers a commit closes.
 *
 * Recognises GitHub's own closing keywords. Deliberately narrow: a bare "#12"
 * is a *mention*, not a claim of completion, and treating the two the same
 * would over-credit discussion as work.
 */
const CLOSING_PATTERN = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;

export function closedIssueNumbers(message: string): number[] {
  const numbers = new Set<number>();

  for (const match of message.matchAll(CLOSING_PATTERN)) {
    const value = Number(match[1]);
    if (Number.isInteger(value) && value > 0) {
      numbers.add(value);
    }
  }

  return [...numbers];
}

/**
 * How a user is told to reference a task. Shown in the task detail UI, because
 * a convention nobody is told about produces a project where nothing verifies.
 */
export function referenceHint(taskId: string): string {
  return `Add ${taskReference(taskId)} to a commit message to link your work to this task.`;
}
