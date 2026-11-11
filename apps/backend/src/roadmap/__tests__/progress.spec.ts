import { TaskEffort, TaskStatus } from '@repo/db';
import { ProgressTask, dailyCompletion, effortPoints, summarizeProgress } from '../progress';

/**
 * Progress rules.
 *
 * These encode the plan's tracker definitions directly: effort-weighted, no
 * double counting, cancelled/deferred excluded, and no divide-by-zero. The
 * previous implementation counted raw tasks, so a user who finished nine small
 * tasks and left the big one saw 90% on work that was barely half done.
 */
describe('progress', () => {
  const task = (status: TaskStatus, effort: TaskEffort | null = null): ProgressTask => ({ status, effort });

  describe('effortPoints', () => {
    it('scales unevenly so a large task dominates a small one', () => {
      expect(effortPoints(task(TaskStatus.TODO, 'SMALL'))).toBe(1);
      expect(effortPoints(task(TaskStatus.TODO, 'MEDIUM'))).toBe(3);
      expect(effortPoints(task(TaskStatus.TODO, 'LARGE'))).toBe(8);
    });

    // Zero would drop the task from the denominator, so leaving tasks
    // unestimated would silently inflate progress.
    it('counts an unestimated task as medium rather than zero', () => {
      expect(effortPoints(task(TaskStatus.TODO, null))).toBe(3);
    });
  });

  describe('summarizeProgress', () => {
    it('weights by effort, not by task count', () => {
      // Nine small done, one large outstanding: 9 of 17 points.
      const tasks = [
        ...Array.from({ length: 9 }, () => task(TaskStatus.DONE, 'SMALL')),
        task(TaskStatus.TODO, 'LARGE'),
      ];

      const result = summarizeProgress(tasks);

      expect(result.percentComplete).toBe(53);
      // The count figure is still available, and still 90%.
      expect(result.percentByCount).toBe(90);
    });

    it('reports counts per status', () => {
      const result = summarizeProgress([
        task(TaskStatus.DONE, 'SMALL'),
        task(TaskStatus.IN_PROGRESS, 'MEDIUM'),
        task(TaskStatus.TODO, 'LARGE'),
      ]);

      expect(result).toMatchObject({ total: 3, done: 1, inProgress: 1, todo: 1 });
      expect(result.totalPoints).toBe(12);
      expect(result.donePoints).toBe(1);
    });

    // The plan: "cancelled/deferred tasks should not distort completion".
    it('excludes cancelled work from both numerator and denominator', () => {
      const withCancelled = summarizeProgress([
        task(TaskStatus.DONE, 'MEDIUM'),
        task(TaskStatus.TODO, 'MEDIUM'),
        task(TaskStatus.CANCELLED, 'LARGE'),
      ]);

      // Same as if the cancelled task had never existed.
      expect(withCancelled.percentComplete).toBe(50);
      expect(withCancelled.total).toBe(2);
      expect(withCancelled.excluded).toBe(1);
    });

    it('excludes deferred work the same way', () => {
      const result = summarizeProgress([task(TaskStatus.DONE, 'MEDIUM'), task(TaskStatus.DEFERRED, 'LARGE')]);

      expect(result.percentComplete).toBe(100);
      expect(result.excluded).toBe(1);
    });

    // Cancelling scope must not look like falling behind.
    it('does not reduce progress when outstanding work is cancelled', () => {
      const before = summarizeProgress([task(TaskStatus.DONE, 'MEDIUM'), task(TaskStatus.TODO, 'LARGE')]);
      const after = summarizeProgress([task(TaskStatus.DONE, 'MEDIUM'), task(TaskStatus.CANCELLED, 'LARGE')]);

      expect(before.percentComplete).toBe(27);
      expect(after.percentComplete).toBe(100);
      expect(after.percentComplete).toBeGreaterThan(before.percentComplete);
    });

    it('is 0% for no tasks rather than NaN', () => {
      const result = summarizeProgress([]);

      expect(result.percentComplete).toBe(0);
      expect(result.percentByCount).toBe(0);
      expect(Number.isNaN(result.percentComplete)).toBe(false);
    });

    // The nastiest divide-by-zero: tasks exist, but every one is excluded.
    it('is 0% when every task is excluded', () => {
      const result = summarizeProgress([task(TaskStatus.CANCELLED), task(TaskStatus.DEFERRED)]);

      expect(result.percentComplete).toBe(0);
      expect(result.total).toBe(0);
      expect(result.excluded).toBe(2);
    });

    it('is 100% when everything counted is done', () => {
      expect(summarizeProgress([task(TaskStatus.DONE, 'SMALL'), task(TaskStatus.DONE, 'LARGE')]).percentComplete).toBe(
        100,
      );
    });

    // A task has one status, so it can only land in one bucket.
    it('never counts a task twice', () => {
      const result = summarizeProgress([
        task(TaskStatus.DONE),
        task(TaskStatus.IN_PROGRESS),
        task(TaskStatus.TODO),
        task(TaskStatus.CANCELLED),
      ]);

      expect(result.done + result.inProgress + result.todo).toBe(result.total);
      expect(result.total + result.excluded).toBe(4);
    });

    // In-progress is not partial credit: it is not done.
    it('gives no credit for in-progress work', () => {
      expect(summarizeProgress([task(TaskStatus.IN_PROGRESS, 'LARGE')]).percentComplete).toBe(0);
    });
  });

  describe('dailyCompletion', () => {
    it('reports completion for a day with planned work', () => {
      const result = dailyCompletion([task(TaskStatus.DONE, 'MEDIUM'), task(TaskStatus.TODO, 'MEDIUM')]);

      expect(result?.percentComplete).toBe(50);
    });

    // A rest day is not a failure. Returning 0% here would be exactly the
    // shame-based framing the plan forbids.
    it('returns null for a day with nothing planned', () => {
      expect(dailyCompletion([])).toBeNull();
    });

    it('returns null when the day held only cancelled work', () => {
      expect(dailyCompletion([task(TaskStatus.CANCELLED), task(TaskStatus.DEFERRED)])).toBeNull();
    });

    it('is 100% for a fully completed day', () => {
      expect(dailyCompletion([task(TaskStatus.DONE), task(TaskStatus.DONE)])?.percentComplete).toBe(100);
    });
  });
});
