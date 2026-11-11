import { SkillLevel, TaskEffort, TaskPriority, TaskStatus } from '@repo/db';
import { effortPoints } from './progress';
import {
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_HOURS_PER_POINT,
  DEFAULT_WORKING_DAYS,
  EXCLUDED_FROM_PROGRESS,
  HOURS_PER_POINT,
  SCHEDULE_BUFFER_RATIO,
} from './roadmap.constants';

export interface SchedulableTask {
  id: string;
  title: string;
  status: TaskStatus;
  effort: TaskEffort | null;
  priority: TaskPriority | null;
}

export interface ScheduleInput {
  tasks: readonly SchedulableTask[];
  /** Null means no deadline, so any amount of work "fits". */
  deadline: Date | null;
  hoursPerDay: number | null;
  /** ISO weekdays, 1 = Monday .. 7 = Sunday. Empty falls back to weekdays. */
  workingDays: readonly number[];
  skillLevel: SkillLevel | null;
  /** Today, injected so this stays a pure function and is testable. */
  from: Date;
}

/** One option offered when the work does not fit. */
export interface ScheduleRemedy {
  kind: 'MORE_HOURS' | 'SHRINK_SCOPE';
}

export interface MoreHoursRemedy extends ScheduleRemedy {
  kind: 'MORE_HOURS';
  /** Hours per working day needed to finish by the deadline. */
  requiredHoursPerDay: number;
  /** On top of what they have now. */
  additionalHoursPerDay: number;
}

export interface ShrinkScopeRemedy extends ScheduleRemedy {
  kind: 'SHRINK_SCOPE';
  /** Tasks to defer, lowest priority first. Never includes completed work. */
  taskIds: string[];
  /** For the confirmation preview, so the user sees what they are cutting. */
  tasks: { id: string; title: string; priority: TaskPriority | null }[];
  /** Hours of work removed. */
  hoursRemoved: number;
}

export interface ScheduleFit {
  /** Remaining (not done, not excluded) effort in points. */
  remainingPoints: number;
  /** Those points converted to hours at this user's assumed pace. */
  remainingHours: number;
  /** Working days between `from` and the deadline, inclusive. */
  availableDays: number;
  /** Hours available after the buffer is held back. */
  availableHours: number;
  /** True when remaining work fits in available hours. */
  fits: boolean;
  /** Hours over budget. 0 when it fits. */
  overflowHours: number;
  /**
   * How to make it fit. Empty when it already fits, or when there is no
   * deadline to miss. The user chooses; the scheduler never applies one.
   */
  remedies: (MoreHoursRemedy | ShrinkScopeRemedy)[];
}

/** Hours one effort point is assumed to take for this user. */
function hoursPerPoint(skillLevel: SkillLevel | null): number {
  return skillLevel ? HOURS_PER_POINT[skillLevel] : DEFAULT_HOURS_PER_POINT;
}

/**
 * Working days from `from` to `deadline`, inclusive of both.
 *
 * Counts actual calendar days against the user's working pattern rather than
 * approximating with `weeks * daysPerWeek`: a five-day deadline starting on a
 * Saturday is two working days, not five, and a roadmap that got that wrong
 * would set dates the user cannot meet.
 */
export function countWorkingDays(from: Date, deadline: Date, workingDays: readonly number[]): number {
  const pattern = workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate()));

  if (end < cursor) {
    return 0;
  }

  let count = 0;
  // Bounded so a far-future or malformed deadline cannot spin: ~5 years.
  for (let guard = 0; cursor <= end && guard < 2000; guard++) {
    // getUTCDay is 0=Sunday; the stored pattern is ISO 1=Monday..7=Sunday.
    const isoDay = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
    if (pattern.includes(isoDay)) {
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

/** Tasks that still represent work: not done, not cancelled, not deferred. */
function remainingTasks(tasks: readonly SchedulableTask[]): SchedulableTask[] {
  return tasks.filter((t) => t.status !== TaskStatus.DONE && !EXCLUDED_FROM_PROGRESS.includes(t.status));
}

/** Cut order: LATER first, then SHOULD_HAVE, then unprioritised, never MUST_HAVE. */
const CUT_ORDER: (TaskPriority | null)[] = ['LATER', 'SHOULD_HAVE', null];

/**
 * Works out whether the remaining work fits before the deadline, and if not,
 * what the user could do about it.
 *
 * Deliberately returns options rather than applying one. Silently extending
 * past the deadline hides the problem; silently deferring tasks changes the
 * user's approved scope without asking. Both are things the plan forbids, so
 * the decision belongs to the user.
 *
 * Completed work is never touched: it is excluded from `remainingPoints` and
 * can never appear in a shrink-scope suggestion.
 */
export function assessSchedule(input: ScheduleInput): ScheduleFit {
  const { tasks, deadline, hoursPerDay, workingDays, skillLevel, from } = input;

  const remaining = remainingTasks(tasks);
  const remainingPoints = remaining.reduce((sum, t) => sum + effortPoints(t), 0);
  const perPoint = hoursPerPoint(skillLevel);
  const remainingHours = remainingPoints * perPoint;

  const dailyHours = hoursPerDay && hoursPerDay > 0 ? hoursPerDay : DEFAULT_HOURS_PER_DAY;

  // No deadline means nothing to miss. Report the workload and stop.
  if (!deadline) {
    return {
      remainingPoints,
      remainingHours,
      availableDays: 0,
      availableHours: 0,
      fits: true,
      overflowHours: 0,
      remedies: [],
    };
  }

  const availableDays = countWorkingDays(from, deadline, workingDays);
  // The buffer is held back for testing and the unexpected, as the plan
  // requires, so "available" is deliberately less than the raw capacity.
  const availableHours = availableDays * dailyHours * (1 - SCHEDULE_BUFFER_RATIO);

  const fits = remainingHours <= availableHours;
  const overflowHours = fits ? 0 : round1(remainingHours - availableHours);

  if (fits) {
    return {
      remainingPoints,
      remainingHours: round1(remainingHours),
      availableDays,
      availableHours: round1(availableHours),
      fits: true,
      overflowHours: 0,
      remedies: [],
    };
  }

  const remedies: (MoreHoursRemedy | ShrinkScopeRemedy)[] = [];

  // Option A: more hours per day. Only offerable if there are days left at all.
  if (availableDays > 0) {
    const requiredHoursPerDay = round1(remainingHours / (availableDays * (1 - SCHEDULE_BUFFER_RATIO)));
    remedies.push({
      kind: 'MORE_HOURS',
      requiredHoursPerDay,
      additionalHoursPerDay: round1(Math.max(requiredHoursPerDay - dailyHours, 0)),
    });
  }

  // Option B: defer the lowest-priority work until the rest fits.
  const toDefer: SchedulableTask[] = [];
  let hoursAfterCuts = remainingHours;

  for (const priority of CUT_ORDER) {
    if (hoursAfterCuts <= availableHours) break;

    const candidates = remaining.filter((t) => t.priority === priority && !toDefer.includes(t));
    // Largest first within a priority band: fewer tasks cut for the same
    // saving, so the user loses less breadth of scope.
    candidates.sort((a, b) => effortPoints(b) - effortPoints(a));

    for (const candidate of candidates) {
      if (hoursAfterCuts <= availableHours) break;
      toDefer.push(candidate);
      hoursAfterCuts -= effortPoints(candidate) * perPoint;
    }
  }

  // Only offer this when it would actually work. MUST_HAVE tasks are never cut,
  // so if deferring everything else still does not fit, suggesting it would be
  // dishonest — the hours option, or a later deadline, is the only way out.
  if (toDefer.length > 0 && hoursAfterCuts <= availableHours) {
    remedies.push({
      kind: 'SHRINK_SCOPE',
      taskIds: toDefer.map((t) => t.id),
      tasks: toDefer.map((t) => ({ id: t.id, title: t.title, priority: t.priority })),
      hoursRemoved: round1(remainingHours - hoursAfterCuts),
    });
  }

  return {
    remainingPoints,
    remainingHours: round1(remainingHours),
    availableDays,
    availableHours: round1(availableHours),
    fits: false,
    overflowHours,
    remedies,
  };
}

/** One decimal place: these are planning estimates, not measurements. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
