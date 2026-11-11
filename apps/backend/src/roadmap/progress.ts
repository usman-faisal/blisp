import { TaskEffort, TaskStatus } from '@repo/db';
import { DEFAULT_EFFORT_POINTS, EXCLUDED_FROM_PROGRESS, TASK_EFFORT_POINTS } from './roadmap.constants';

/** The minimum a progress calculation needs to know about a task. */
export interface ProgressTask {
  status: TaskStatus;
  effort: TaskEffort | null;
}

export interface ProgressSummary {
  /** Tasks counted, excluding cancelled and deferred. */
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  /** Effort points counted, excluding cancelled and deferred. */
  totalPoints: number;
  donePoints: number;
  /** 0-100, weighted by effort. The headline figure. */
  percentComplete: number;
  /** 0-100, by raw task count. Shown alongside, never instead. */
  percentByCount: number;
  /** Cancelled and deferred, reported separately so they are visible not hidden. */
  excluded: number;
}

/** Points a task contributes. Unestimated counts as MEDIUM — see the constant. */
export function effortPoints(task: ProgressTask): number {
  return task.effort ? TASK_EFFORT_POINTS[task.effort] : DEFAULT_EFFORT_POINTS;
}

/**
 * The single source of truth for progress.
 *
 * Every progress figure in the product — daily, milestone, project — goes
 * through this function. The plan requires one consistent rule, and the
 * previous implementation had a second, different one inline in
 * projects.service.ts that counted raw tasks.
 *
 * Rules, all from the plan:
 * - Weighted by effort, not raw count. `percentByCount` is also returned so the
 *   UI can show both, since a user who has done 9 of 10 small tasks and none of
 *   the big one deserves to see that distinction.
 * - Cancelled and deferred tasks are excluded from numerator *and* denominator.
 * - No task is counted twice: a task has exactly one status.
 * - A zero-task set is 0%, never NaN.
 */
export function summarizeProgress(tasks: readonly ProgressTask[]): ProgressSummary {
  const excludedTasks = tasks.filter((t) => EXCLUDED_FROM_PROGRESS.includes(t.status));
  const counted = tasks.filter((t) => !EXCLUDED_FROM_PROGRESS.includes(t.status));

  const done = counted.filter((t) => t.status === TaskStatus.DONE);
  const inProgress = counted.filter((t) => t.status === TaskStatus.IN_PROGRESS);
  const todo = counted.filter((t) => t.status === TaskStatus.TODO);

  const totalPoints = counted.reduce((sum, t) => sum + effortPoints(t), 0);
  const donePoints = done.reduce((sum, t) => sum + effortPoints(t), 0);

  return {
    total: counted.length,
    done: done.length,
    inProgress: inProgress.length,
    todo: todo.length,
    totalPoints,
    donePoints,
    // Both guards matter: a project with only cancelled tasks has zero counted
    // tasks and zero points, and must read 0% rather than NaN or 100%.
    percentComplete: totalPoints === 0 ? 0 : Math.round((donePoints / totalPoints) * 100),
    percentByCount: counted.length === 0 ? 0 : Math.round((done.length / counted.length) * 100),
    excluded: excludedTasks.length,
  };
}

/**
 * Daily completion: completed planned tasks over total planned tasks for that
 * day, exactly as the plan defines it.
 *
 * Returns null for a day with nothing planned, rather than 0% or 100%. A rest
 * day is not a failure, and the plan forbids shame-based framing — showing "0%
 * complete" for a day the user never planned to work would be exactly that.
 */
export function dailyCompletion(tasks: readonly ProgressTask[]): ProgressSummary | null {
  const counted = tasks.filter((t) => !EXCLUDED_FROM_PROGRESS.includes(t.status));
  if (counted.length === 0) {
    return null;
  }
  return summarizeProgress(tasks);
}
