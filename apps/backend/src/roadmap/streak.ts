/** One day's completion count, oldest first. */
export interface StreakDay {
  /** YYYY-MM-DD. */
  date: string;
  completed: number;
}

export interface StreakSummary {
  /** Consecutive active days ending today or yesterday. See the note below. */
  current: number;
  /** Longest run of active days in the window. */
  longest: number;
  /** Days with at least one completion, in the whole window. */
  activeDays: number;
}

/**
 * Completion streaks.
 *
 * Counts consecutive days with at least one completed task. Two decisions here
 * are deliberate and both follow the plan's rule against shame-based framing:
 *
 * - **A streak survives today being empty.** It is measured from the most
 *   recent active day, so a user who has not worked *yet today* has not lost
 *   anything. Only a fully empty previous day ends it. Without this, opening
 *   the app in the morning would report a broken streak before the user has
 *   had a chance to do anything.
 * - **Zero is just zero.** There is no "broken" state, no previous-best
 *   comparison and no language about losing progress — the UI shows a count or
 *   nothing at all.
 */
export function summarizeStreak(days: readonly StreakDay[]): StreakSummary {
  if (days.length === 0) {
    return { current: 0, longest: 0, activeDays: 0 };
  }

  const activeDays = days.filter((d) => d.completed > 0).length;

  // Longest run anywhere in the window.
  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (day.completed > 0) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  // Current run, walking backwards from the end of the window. Today is skipped
  // when empty so an unstarted day does not read as a break; any earlier empty
  // day does end the run.
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (!day) break;

    if (day.completed > 0) {
      current++;
      continue;
    }

    // The final entry is today. An empty today is not yet a missed day.
    if (i === days.length - 1) {
      continue;
    }

    break;
  }

  return { current, longest, activeDays };
}
