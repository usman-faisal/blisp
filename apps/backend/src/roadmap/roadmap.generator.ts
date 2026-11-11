import { TaskEffort, TaskPriority } from '@repo/db';
import { TASK_EFFORT_POINTS } from './roadmap.constants';

/** One item of scope the user is planning to build. */
export interface ScopeItem {
  title: string;
  priority: TaskPriority;
  effort: TaskEffort;
  /** True when it came from the approved report rather than the user. */
  fromReport: boolean;
}

export interface PlannedTask {
  title: string;
  priority: TaskPriority;
  effort: TaskEffort;
}

export interface PlannedMilestone {
  title: string;
  position: number;
  targetDate: Date | null;
  tasks: PlannedTask[];
}

export interface GeneratePlanInput {
  scope: readonly ScopeItem[];
  deadline: Date | null;
  hoursPerDay: number;
  workingDays: readonly number[];
  hoursPerPoint: number;
  /** Today, injected to keep this pure and testable. */
  from: Date;
}

/**
 * Milestone shape for an MVP build.
 *
 * Three phases rather than one per feature: a roadmap with fifteen one-task
 * milestones is a task list with extra ceremony. The bands match how the scope
 * already arrives from the discovery report (must/should/later), so a user who
 * approved that report sees a roadmap that follows it.
 */
const MILESTONE_BANDS: { title: string; priorities: TaskPriority[] }[] = [
  { title: 'Core MVP', priorities: ['MUST_HAVE'] },
  { title: 'Polish and quality', priorities: ['SHOULD_HAVE'] },
  { title: 'Later improvements', priorities: ['LATER'] },
];

/**
 * Extracts editable scope from an approved discovery report.
 *
 * Only `mvpScope` is used, not `recommendedFeatures`: the two overlap heavily
 * and taking both would duplicate the same work under different wording. Every
 * item is marked `fromReport` so the UI can show provenance, and the caller is
 * expected to let the user edit or remove any of it before planning.
 *
 * Effort is assigned by band rather than guessed per item: the report does not
 * estimate individual features, and inventing a per-feature size would be false
 * precision. MUST_HAVE work is assumed MEDIUM because it is load-bearing,
 * while LATER items are usually larger and less defined.
 */
export function scopeFromReport(mvpScope: {
  mustHave?: string[];
  shouldHave?: string[];
  later?: string[];
}): ScopeItem[] {
  const bands: { items: string[]; priority: TaskPriority; effort: TaskEffort }[] = [
    { items: mvpScope.mustHave ?? [], priority: 'MUST_HAVE', effort: 'MEDIUM' },
    { items: mvpScope.shouldHave ?? [], priority: 'SHOULD_HAVE', effort: 'SMALL' },
    { items: mvpScope.later ?? [], priority: 'LATER', effort: 'LARGE' },
  ];

  return bands.flatMap((band) =>
    band.items
      .map((title) => title.trim())
      .filter((title) => title.length > 0)
      .map((title) => ({
        title: title.slice(0, 255),
        priority: band.priority,
        effort: band.effort,
        fromReport: true,
      })),
  );
}

/**
 * Turns scope into dated milestones.
 *
 * Dates are derived from the user's actual availability — working days between
 * now and the deadline, at their hours per day — rather than by dividing the
 * calendar evenly. A milestone's target is the day its cumulative effort is
 * expected to be finished.
 *
 * Milestones whose work lands past the deadline still get real dates rather
 * than being clipped to it. Pretending everything fits would hide exactly the
 * problem the scheduler exists to surface; `assessSchedule` reports the
 * overflow and offers the user a choice.
 */
export function generatePlan(input: GeneratePlanInput): PlannedMilestone[] {
  const { scope, deadline, hoursPerDay, workingDays, hoursPerPoint, from } = input;

  const milestones: PlannedMilestone[] = [];
  let position = 1;
  // Running total across milestones, so milestone 2's date accounts for
  // milestone 1's work rather than starting from today.
  let cumulativeHours = 0;

  for (const band of MILESTONE_BANDS) {
    const items = scope.filter((s) => band.priorities.includes(s.priority));
    if (items.length === 0) {
      // No empty milestones: a roadmap with a "Later improvements" heading and
      // nothing under it is noise.
      continue;
    }

    const bandHours = items.reduce((sum, item) => sum + TASK_EFFORT_POINTS[item.effort] * hoursPerPoint, 0);
    cumulativeHours += bandHours;

    milestones.push({
      title: band.title,
      position: position++,
      targetDate: deadline ? dateAfterHours(from, cumulativeHours, hoursPerDay, workingDays) : null,
      tasks: items.map((item) => ({
        title: item.title,
        priority: item.priority,
        effort: item.effort,
      })),
    });
  }

  return milestones;
}

/**
 * The working day by which `hours` of work is expected to be done.
 *
 * Walks the calendar honouring the working pattern rather than dividing by an
 * average day length: a user who works weekends only needs 3.5 calendar weeks
 * for 7 working days, and an averaged calculation would promise it in one.
 */
export function dateAfterHours(from: Date, hours: number, hoursPerDay: number, workingDays: readonly number[]): Date {
  const pattern = workingDays.length > 0 ? workingDays : [1, 2, 3, 4, 5];
  const perDay = hoursPerDay > 0 ? hoursPerDay : 1;
  const daysNeeded = Math.max(Math.ceil(hours / perDay), 1);

  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let workingDaysSeen = 0;

  // Bounded so a tiny hoursPerDay against a large scope cannot spin: ~5 years.
  for (let guard = 0; guard < 2000; guard++) {
    const isoDay = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
    if (pattern.includes(isoDay)) {
      workingDaysSeen++;
      if (workingDaysSeen >= daysNeeded) {
        return cursor;
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return cursor;
}
