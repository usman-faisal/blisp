import { TaskPriority, TaskStatus } from '@repo/db';
import { MoreHoursRemedy, SchedulableTask, ShrinkScopeRemedy, assessSchedule, countWorkingDays } from '../scheduler';

/**
 * Schedule fitting.
 *
 * The rule under test throughout: when work does not fit, the scheduler offers
 * options and never applies one. Silently extending past a deadline hides the
 * problem; silently deferring tasks changes approved scope without asking.
 */
describe('scheduler', () => {
  // A Monday, so working-day arithmetic is easy to reason about.
  const MONDAY = new Date('2026-11-16T00:00:00Z');
  const WEEKDAYS = [1, 2, 3, 4, 5];

  let nextId = 0;
  const task = (
    effort: SchedulableTask['effort'],
    priority: TaskPriority | null = null,
    status: TaskStatus = TaskStatus.TODO,
  ): SchedulableTask => ({ id: `t${++nextId}`, title: `Task ${nextId}`, status, effort, priority });

  describe('countWorkingDays', () => {
    it('counts both endpoints', () => {
      // Mon 16th to Fri 20th inclusive.
      expect(countWorkingDays(MONDAY, new Date('2026-11-20T00:00:00Z'), WEEKDAYS)).toBe(5);
    });

    // Approximating with weeks * daysPerWeek would get this wrong and set
    // dates the user cannot meet.
    it('skips non-working days rather than approximating', () => {
      // Mon 16th to Mon 23rd is 8 calendar days but 6 weekdays.
      expect(countWorkingDays(MONDAY, new Date('2026-11-23T00:00:00Z'), WEEKDAYS)).toBe(6);
    });

    it('honours a weekend-only working pattern', () => {
      // Sat 21st and Sun 22nd only.
      expect(countWorkingDays(MONDAY, new Date('2026-11-23T00:00:00Z'), [6, 7])).toBe(2);
    });

    it('is 0 for a deadline already past', () => {
      expect(countWorkingDays(MONDAY, new Date('2026-11-10T00:00:00Z'), WEEKDAYS)).toBe(0);
    });

    it('falls back to weekdays when no pattern is set', () => {
      expect(countWorkingDays(MONDAY, new Date('2026-11-20T00:00:00Z'), [])).toBe(5);
    });

    it('terminates on an absurd deadline rather than spinning', () => {
      expect(countWorkingDays(MONDAY, new Date('2099-01-01T00:00:00Z'), WEEKDAYS)).toBeGreaterThan(0);
    });
  });

  describe('assessSchedule — fitting', () => {
    const base = {
      deadline: new Date('2026-11-20T00:00:00Z'), // Fri, 5 working days
      hoursPerDay: 4,
      workingDays: WEEKDAYS,
      skillLevel: 'INTERMEDIATE' as const,
      from: MONDAY,
    };

    it('fits when the work is comfortably inside the budget', () => {
      // 2 small = 2 points = 3h at 1.5h/point. Budget 5*4*0.8 = 16h.
      const result = assessSchedule({ ...base, tasks: [task('SMALL'), task('SMALL')] });

      expect(result.fits).toBe(true);
      expect(result.remedies).toHaveLength(0);
      expect(result.overflowHours).toBe(0);
    });

    // The plan requires buffer time for testing and the unexpected.
    it('holds back a buffer rather than promising full capacity', () => {
      const result = assessSchedule({ ...base, tasks: [] });

      // 5 days * 4h = 20h raw, less the 20% buffer.
      expect(result.availableHours).toBe(16);
    });

    it('excludes completed work from the remaining total', () => {
      const result = assessSchedule({
        ...base,
        tasks: [task('LARGE', null, TaskStatus.DONE), task('SMALL')],
      });

      expect(result.remainingPoints).toBe(1);
    });

    it('excludes cancelled and deferred work', () => {
      const result = assessSchedule({
        ...base,
        tasks: [task('LARGE', null, TaskStatus.CANCELLED), task('LARGE', null, TaskStatus.DEFERRED), task('SMALL')],
      });

      expect(result.remainingPoints).toBe(1);
    });

    it('paces a beginner more slowly than an expert', () => {
      const beginner = assessSchedule({ ...base, skillLevel: 'BEGINNER', tasks: [task('LARGE')] });
      const advanced = assessSchedule({ ...base, skillLevel: 'ADVANCED', tasks: [task('LARGE')] });

      expect(beginner.remainingHours).toBeGreaterThan(advanced.remainingHours);
    });

    // No deadline means nothing to miss.
    it('always fits when there is no deadline, but still reports the workload', () => {
      const result = assessSchedule({ ...base, deadline: null, tasks: [task('LARGE'), task('LARGE')] });

      expect(result.fits).toBe(true);
      expect(result.remedies).toHaveLength(0);
      expect(result.remainingPoints).toBe(16);
    });

    it('treats an unestimated task as medium rather than free', () => {
      const result = assessSchedule({ ...base, tasks: [task(null)] });

      expect(result.remainingPoints).toBe(3);
    });
  });

  describe('assessSchedule — when work does not fit', () => {
    const tight = {
      deadline: new Date('2026-11-17T00:00:00Z'), // Tue, 2 working days
      hoursPerDay: 2,
      workingDays: WEEKDAYS,
      skillLevel: 'INTERMEDIATE' as const,
      from: MONDAY,
    };

    it('reports the overflow instead of quietly extending', () => {
      const result = assessSchedule({ ...tight, tasks: [task('LARGE', 'MUST_HAVE')] });

      // 8 points * 1.5 = 12h against 2*2*0.8 = 3.2h.
      expect(result.fits).toBe(false);
      expect(result.overflowHours).toBeCloseTo(8.8, 1);
    });

    it('offers the hours needed to hit the deadline', () => {
      const result = assessSchedule({ ...tight, tasks: [task('LARGE', 'MUST_HAVE')] });

      const hours = result.remedies.find((r): r is MoreHoursRemedy => r.kind === 'MORE_HOURS');
      expect(hours?.requiredHoursPerDay).toBeCloseTo(7.5, 1);
      expect(hours?.additionalHoursPerDay).toBeCloseTo(5.5, 1);
    });

    it('offers a scope cut, lowest priority first', () => {
      const result = assessSchedule({
        ...tight,
        tasks: [task('SMALL', 'MUST_HAVE'), task('MEDIUM', 'LATER'), task('MEDIUM', 'SHOULD_HAVE')],
      });

      const shrink = result.remedies.find((r): r is ShrinkScopeRemedy => r.kind === 'SHRINK_SCOPE');
      expect(shrink).toBeDefined();
      // LATER goes before SHOULD_HAVE.
      expect(shrink?.tasks[0]?.priority).toBe('LATER');
    });

    // The core guarantee: the user's committed scope is never on the chopping
    // block, and completed work is never touched.
    it('never suggests deferring a MUST_HAVE task', () => {
      const result = assessSchedule({
        ...tight,
        tasks: [task('LARGE', 'MUST_HAVE'), task('SMALL', 'LATER')],
      });

      const shrink = result.remedies.find((r): r is ShrinkScopeRemedy => r.kind === 'SHRINK_SCOPE');
      const cutPriorities = shrink?.tasks.map((t) => t.priority) ?? [];
      expect(cutPriorities).not.toContain('MUST_HAVE');
    });

    it('never suggests deferring completed work', () => {
      const done = task('LARGE', 'LATER', TaskStatus.DONE);
      const result = assessSchedule({ ...tight, tasks: [done, task('LARGE', 'MUST_HAVE')] });

      const shrink = result.remedies.find((r): r is ShrinkScopeRemedy => r.kind === 'SHRINK_SCOPE');
      expect(shrink?.taskIds ?? []).not.toContain(done.id);
    });

    // Suggesting a cut that would not actually work is dishonest.
    it('withholds the scope option when even deferring everything cuttable fails', () => {
      const result = assessSchedule({
        ...tight,
        tasks: [task('LARGE', 'MUST_HAVE'), task('LARGE', 'MUST_HAVE'), task('SMALL', 'LATER')],
      });

      expect(result.remedies.some((r) => r.kind === 'SHRINK_SCOPE')).toBe(false);
      // The hours option is still there, since that can always close the gap.
      expect(result.remedies.some((r) => r.kind === 'MORE_HOURS')).toBe(true);
    });

    it('cuts the fewest tasks for the saving, largest first within a band', () => {
      const result = assessSchedule({
        ...tight,
        tasks: [task('SMALL', 'LATER'), task('LARGE', 'LATER'), task('SMALL', 'MUST_HAVE')],
      });

      const shrink = result.remedies.find((r): r is ShrinkScopeRemedy => r.kind === 'SHRINK_SCOPE');
      // The large LATER task alone closes the gap, so only it is cut.
      expect(shrink?.taskIds).toHaveLength(1);
    });

    // A deadline in the past has no days to add hours to.
    it('offers no hours option when the deadline has already passed', () => {
      const result = assessSchedule({
        ...tight,
        deadline: new Date('2026-11-10T00:00:00Z'),
        tasks: [task('SMALL', 'MUST_HAVE')],
      });

      expect(result.availableDays).toBe(0);
      expect(result.remedies.some((r) => r.kind === 'MORE_HOURS')).toBe(false);
    });

    it('reports a clean fit for an empty backlog even on a tight deadline', () => {
      const result = assessSchedule({ ...tight, tasks: [] });

      expect(result.fits).toBe(true);
      expect(result.remainingPoints).toBe(0);
    });
  });
});
