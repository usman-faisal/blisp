import { StreakDay, summarizeStreak } from '../streak';

/**
 * Streaks.
 *
 * The behaviour worth pinning down is what happens on an empty *today*: a user
 * opening the app in the morning must not be told their streak is broken before
 * they have had a chance to do anything. The plan forbids shame-based framing.
 */
describe('summarizeStreak', () => {
  const d = (date: string, completed: number): StreakDay => ({ date, completed });

  it('counts consecutive active days', () => {
    const result = summarizeStreak([d('2026-11-09', 1), d('2026-11-10', 2), d('2026-11-11', 1)]);

    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
    expect(result.activeDays).toBe(3);
  });

  // The key case.
  it('keeps the streak alive when today is still empty', () => {
    const result = summarizeStreak([
      d('2026-11-09', 1),
      d('2026-11-10', 2),
      d('2026-11-11', 0), // today, nothing done yet
    ]);

    expect(result.current).toBe(2);
  });

  it('ends the streak on an empty earlier day', () => {
    const result = summarizeStreak([
      d('2026-11-08', 3),
      d('2026-11-09', 0), // a genuine missed day
      d('2026-11-10', 1),
      d('2026-11-11', 1),
    ]);

    expect(result.current).toBe(2);
    expect(result.longest).toBe(2);
  });

  it('reports the longest run even when the current one is shorter', () => {
    const result = summarizeStreak([
      d('2026-11-05', 1),
      d('2026-11-06', 1),
      d('2026-11-07', 1),
      d('2026-11-08', 1),
      d('2026-11-09', 0),
      d('2026-11-10', 1),
      d('2026-11-11', 1),
    ]);

    expect(result.longest).toBe(4);
    expect(result.current).toBe(2);
  });

  it('is all zeroes for a window with no completions', () => {
    expect(summarizeStreak([d('2026-11-10', 0), d('2026-11-11', 0)])).toEqual({
      current: 0,
      longest: 0,
      activeDays: 0,
    });
  });

  it('handles an empty window', () => {
    expect(summarizeStreak([])).toEqual({ current: 0, longest: 0, activeDays: 0 });
  });

  it('counts a single active day', () => {
    expect(summarizeStreak([d('2026-11-11', 5)]).current).toBe(1);
  });

  // An empty today with nothing before it is still zero, not one.
  it('does not invent a streak from an empty today alone', () => {
    expect(summarizeStreak([d('2026-11-11', 0)]).current).toBe(0);
  });
});
