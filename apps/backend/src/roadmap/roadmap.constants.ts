import { TaskEffort, TaskStatus } from '@repo/db';

/**
 * Effort points per size.
 *
 * A 1/3/8 scale rather than 1/2/3: the gaps are deliberately uneven so a LARGE
 * task dominates a SMALL one in weighted progress, which is the point of
 * weighting at all. Roughly Fibonacci, as planning-poker scales are, because
 * estimates get less precise as they get bigger.
 */
export const TASK_EFFORT_POINTS: Record<TaskEffort, number> = {
  SMALL: 1,
  MEDIUM: 3,
  LARGE: 8,
};

/**
 * Points for a task nobody estimated.
 *
 * Counted as MEDIUM rather than zero: a zero-point task would vanish from the
 * denominator, so leaving tasks unestimated would silently inflate progress.
 */
export const DEFAULT_EFFORT_POINTS = TASK_EFFORT_POINTS.MEDIUM;

/**
 * Statuses excluded from every completion percentage.
 *
 * The plan is explicit that cancelled and deferred work must not distort
 * completion. Excluding them from *both* numerator and denominator is the only
 * treatment that satisfies that: counting them as incomplete would make
 * dropping scope look like falling behind, and counting them as complete would
 * overstate progress.
 */
export const EXCLUDED_FROM_PROGRESS: readonly TaskStatus[] = [TaskStatus.CANCELLED, TaskStatus.DEFERRED];

/** Statuses that count toward the denominator of any progress figure. */
export const COUNTED_IN_PROGRESS: readonly TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];

/**
 * Share of available time held back for testing and the unexpected.
 *
 * The plan requires buffer time explicitly. 20% is a conventional allowance and
 * errs toward a roadmap the user can actually finish — the plan's stated
 * preference is a shorter achievable scope over an impressive unfinishable one.
 */
export const SCHEDULE_BUFFER_RATIO = 0.2;

/**
 * Hours a point is assumed to take, by skill level.
 *
 * Deliberately crude, and padded for beginners rather than optimistic: a
 * roadmap that silently assumes expert pace sets a beginner up to miss every
 * date. These are planning assumptions, not measurements, and the UI says so.
 */
export const HOURS_PER_POINT: Record<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED', number> = {
  BEGINNER: 2.5,
  INTERMEDIATE: 1.5,
  ADVANCED: 1,
};

/** Fallback when the user has not said how experienced they are. */
export const DEFAULT_HOURS_PER_POINT = HOURS_PER_POINT.INTERMEDIATE;

/** Fallback working pattern: weekdays, a couple of hours a day. */
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];
export const DEFAULT_HOURS_PER_DAY = 2;

/** Guards against a pathological deadline producing thousands of milestones. */
export const MAX_MILESTONES = 8;
