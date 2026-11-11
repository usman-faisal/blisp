import { ScopeItem, dateAfterHours, generatePlan, scopeFromReport } from '../roadmap.generator';

describe('roadmap generator', () => {
  const MONDAY = new Date('2026-11-16T00:00:00Z');
  const WEEKDAYS = [1, 2, 3, 4, 5];

  describe('scopeFromReport', () => {
    // The real shape, taken from the approved report on the dev database.
    const mvpScope = {
      mustHave: ['Add task input', 'Mark complete / delete', 'Persist tasks in browser local storage'],
      shouldHave: ['Dark mode toggle', 'Recurring task toggle'],
      later: ['Cross-device sync', 'Multiple list support'],
    };

    it('maps each band to its priority', () => {
      const scope = scopeFromReport(mvpScope);

      expect(scope.filter((s) => s.priority === 'MUST_HAVE')).toHaveLength(3);
      expect(scope.filter((s) => s.priority === 'SHOULD_HAVE')).toHaveLength(2);
      expect(scope.filter((s) => s.priority === 'LATER')).toHaveLength(2);
    });

    // Provenance matters: the UI labels these as suggestions, and the user is
    // meant to be able to tell what came from the report.
    it('marks every item as coming from the report', () => {
      expect(scopeFromReport(mvpScope).every((s) => s.fromReport)).toBe(true);
    });

    it('handles a report with only must-haves', () => {
      const scope = scopeFromReport({ mustHave: ['One thing'] });

      expect(scope).toHaveLength(1);
      expect(scope[0]?.priority).toBe('MUST_HAVE');
    });

    it('returns nothing for an empty scope rather than throwing', () => {
      expect(scopeFromReport({})).toEqual([]);
    });

    it('drops blank entries', () => {
      expect(scopeFromReport({ mustHave: ['', '   ', 'Real'] })).toHaveLength(1);
    });

    it('truncates an over-long title to the column width', () => {
      const scope = scopeFromReport({ mustHave: ['x'.repeat(400)] });

      expect(scope[0]?.title).toHaveLength(255);
    });
  });

  describe('dateAfterHours', () => {
    it('lands on the working day the work finishes', () => {
      // 8h at 2h/day = 4 working days: Mon, Tue, Wed, Thu.
      expect(dateAfterHours(MONDAY, 8, 2, WEEKDAYS).toISOString().slice(0, 10)).toBe('2026-11-19');
    });

    // Averaging calendar days would promise this far too early.
    it('honours a weekend-only pattern', () => {
      // 3 working days of weekends from Mon 16th: Sat 21, Sun 22, Sat 28.
      expect(dateAfterHours(MONDAY, 6, 2, [6, 7]).toISOString().slice(0, 10)).toBe('2026-11-28');
    });

    it('never returns earlier than the first working day', () => {
      const result = dateAfterHours(MONDAY, 0.1, 8, WEEKDAYS);

      expect(result.toISOString().slice(0, 10)).toBe('2026-11-16');
    });

    it('terminates rather than spinning on an impossible workload', () => {
      expect(dateAfterHours(MONDAY, 100000, 0.5, WEEKDAYS)).toBeInstanceOf(Date);
    });
  });

  describe('generatePlan', () => {
    const scope: ScopeItem[] = [
      { title: 'Core A', priority: 'MUST_HAVE', effort: 'MEDIUM', fromReport: true },
      { title: 'Core B', priority: 'MUST_HAVE', effort: 'MEDIUM', fromReport: true },
      { title: 'Polish A', priority: 'SHOULD_HAVE', effort: 'SMALL', fromReport: true },
      { title: 'Later A', priority: 'LATER', effort: 'LARGE', fromReport: true },
    ];

    const base = {
      deadline: new Date('2026-12-31T00:00:00Z'),
      hoursPerDay: 2,
      workingDays: WEEKDAYS,
      hoursPerPoint: 1.5,
      from: MONDAY,
    };

    it('groups scope into three bands in priority order', () => {
      const plan = generatePlan({ ...base, scope });

      expect(plan.map((m) => m.title)).toEqual(['Core MVP', 'Polish and quality', 'Later improvements']);
      expect(plan.map((m) => m.position)).toEqual([1, 2, 3]);
    });

    it('puts each task in the milestone matching its priority', () => {
      const plan = generatePlan({ ...base, scope });

      expect(plan[0]?.tasks.map((t) => t.title)).toEqual(['Core A', 'Core B']);
      expect(plan[1]?.tasks.map((t) => t.title)).toEqual(['Polish A']);
      expect(plan[2]?.tasks.map((t) => t.title)).toEqual(['Later A']);
    });

    // A heading with nothing under it is noise.
    it('omits a band with no scope in it', () => {
      const plan = generatePlan({
        ...base,
        scope: [{ title: 'Only core', priority: 'MUST_HAVE', effort: 'SMALL', fromReport: false }],
      });

      expect(plan).toHaveLength(1);
      expect(plan[0]?.position).toBe(1);
    });

    // Milestone 2's date must account for milestone 1's work.
    it('dates milestones cumulatively, not each from today', () => {
      const plan = generatePlan({ ...base, scope });

      const first = plan[0]?.targetDate?.getTime() ?? 0;
      const second = plan[1]?.targetDate?.getTime() ?? 0;
      const third = plan[2]?.targetDate?.getTime() ?? 0;

      expect(second).toBeGreaterThan(first);
      expect(third).toBeGreaterThan(second);
    });

    it('leaves dates null when there is no deadline', () => {
      const plan = generatePlan({ ...base, deadline: null, scope });

      expect(plan.every((m) => m.targetDate === null)).toBe(true);
    });

    // Clipping dates to the deadline would hide the overflow that
    // assessSchedule exists to surface.
    it('lets a date fall past the deadline rather than pretending it fits', () => {
      const plan = generatePlan({
        ...base,
        deadline: new Date('2026-11-17T00:00:00Z'),
        scope: [{ title: 'Huge', priority: 'MUST_HAVE', effort: 'LARGE', fromReport: false }],
      });

      expect(plan[0]?.targetDate?.getTime()).toBeGreaterThan(new Date('2026-11-17T00:00:00Z').getTime());
    });

    it('carries priority and effort onto the created tasks', () => {
      const plan = generatePlan({ ...base, scope });

      expect(plan[0]?.tasks[0]).toMatchObject({ priority: 'MUST_HAVE', effort: 'MEDIUM' });
    });

    it('produces nothing for empty scope', () => {
      expect(generatePlan({ ...base, scope: [] })).toEqual([]);
    });

    // A beginner's roadmap must stretch further than an expert's.
    it('dates later for a slower assumed pace', () => {
      const fast = generatePlan({ ...base, hoursPerPoint: 1, scope });
      const slow = generatePlan({ ...base, hoursPerPoint: 2.5, scope });

      expect(slow[0]?.targetDate?.getTime()).toBeGreaterThan(fast[0]?.targetDate?.getTime() ?? 0);
    });
  });
});
