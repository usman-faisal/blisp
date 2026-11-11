import Text from '@/components/ui/Text';
import type { ProgressSummaryPayload, TaskEffortValue, TaskPriorityValue } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

/**
 * Effort-weighted progress, with the task count shown beside it.
 *
 * Both figures appear deliberately. Nine small tasks done with one large one
 * outstanding is 90% by count but 53% by effort, and showing only the
 * flattering number would misrepresent how much work is left.
 */
export function ProgressBar({
  progress,
  label,
  compact = false,
}: {
  progress: ProgressSummaryPayload;
  label?: string;
  compact?: boolean;
}) {
  const { percentComplete, percentByCount, done, total, excluded } = progress;

  return (
    <View>
      <View className="flex-row items-end justify-between">
        <View className="flex-1">
          {label && (
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
              {label}
            </Text>
          )}
          <Text className="mt-0.5 text-xs text-core-text-secondary">
            {done} of {total} task{total === 1 ? '' : 's'}
            {/* Surfaced rather than hidden: dropped work should be visible. */}
            {excluded > 0 ? ` · ${excluded} set aside` : ''}
          </Text>
        </View>
        <Text className="text-sm font-semibold text-brand-ember">{percentComplete}%</Text>
      </View>

      <View className={`${compact ? 'mt-1.5 h-1.5' : 'mt-2 h-2'} overflow-hidden rounded-full bg-core-surface-elevated`}>
        <View className="h-full rounded-full bg-brand-ember" style={{ width: `${percentComplete}%` }} />
      </View>

      {!compact && total > 0 && (
        <Text className="mt-1.5 text-[10px] text-core-text-disabled">
          Weighted by effort. By task count it is {percentByCount}%.
        </Text>
      )}
    </View>
  );
}

const EFFORT_CONFIG: Record<TaskEffortValue, { label: string; dots: number }> = {
  SMALL: { label: 'S', dots: 1 },
  MEDIUM: { label: 'M', dots: 2 },
  LARGE: { label: 'L', dots: 3 },
};

/** Effort as a size letter — compact enough to sit on a task row. */
export function EffortBadge({ effort }: { effort: TaskEffortValue | null }) {
  // An unestimated task is shown as such rather than silently as medium, even
  // though it is weighted as medium: the user should know it is a guess.
  if (!effort) {
    return (
      <View className="h-5 w-5 items-center justify-center rounded-md bg-core-surface">
        <Text className="text-[9px] font-semibold text-core-text-disabled">?</Text>
      </View>
    );
  }

  const config = EFFORT_CONFIG[effort];

  return (
    <View className="h-5 w-5 items-center justify-center rounded-md bg-core-surface">
      <Text className="text-[9px] font-semibold text-core-text-secondary">{config.label}</Text>
    </View>
  );
}

const PRIORITY_CONFIG: Record<TaskPriorityValue, { label: string; color: string; bg: string }> = {
  MUST_HAVE: { label: 'Must', color: '#E8612A', bg: 'bg-brand-ember-mist' },
  SHOULD_HAVE: { label: 'Should', color: '#C9A84C', bg: 'bg-brand-flax/15' },
  LATER: { label: 'Later', color: '#6B6560', bg: 'bg-core-surface' },
};

export function PriorityChip({ priority }: { priority: TaskPriorityValue | null }) {
  if (!priority) return null;

  const config = PRIORITY_CONFIG[priority];

  return (
    <View className={`rounded-md px-1.5 py-0.5 ${config.bg}`}>
      <Text style={{ color: config.color }} className="text-[9px] font-semibold uppercase">
        {config.label}
      </Text>
    </View>
  );
}

/**
 * A week of completions as a small bar row.
 *
 * Empty days render as a flat baseline rather than being omitted, so a gap
 * reads as "nothing that day" instead of a missing bar.
 *
 * A streak is shown only when there is one to show. There is no "broken
 * streak" state, no previous-best comparison and no language about losing
 * progress: the plan forbids shame-based framing, and a missed day is not a
 * failure.
 */
export function WeekStrip({
  days,
  streak,
}: {
  days: { date: string; completed: number; points: number }[];
  streak?: { current: number; longest: number; activeDays: number } | null;
}) {
  if (days.length === 0) return null;

  const max = Math.max(...days.map((d) => d.completed), 1);
  const totalDone = days.reduce((sum, d) => sum + d.completed, 0);
  const activeDays = days.filter((d) => d.completed > 0).length;

  return (
    <View className="mt-4 rounded-2xl bg-core-surface/60 p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="calendar-outline" size={13} color="#C9A84C" />
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand-flax">
            Last 7 days
          </Text>
        </View>
        {/* A streak is shown only when there is one. Zero renders as the plain
            task count instead: there is no "broken streak" state to announce. */}
        {streak && streak.current > 1 ? (
          <View className="flex-row items-center gap-x-1">
            <Ionicons name="flame" size={12} color="#E8612A" />
            <Text className="text-[11px] font-semibold text-brand-ember">
              {streak.current} day{streak.current === 1 ? '' : 's'} running
            </Text>
          </View>
        ) : (
          <Text className="text-[11px] text-core-text-secondary">
            {totalDone} task{totalDone === 1 ? '' : 's'} on {activeDays} day{activeDays === 1 ? '' : 's'}
          </Text>
        )}
      </View>

      <View className="mt-3 flex-row items-end justify-between" style={{ height: 44 }}>
        {days.map((day) => {
          const height = day.completed === 0 ? 3 : Math.max(Math.round((day.completed / max) * 40), 6);
          const weekday = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
            weekday: 'narrow',
            timeZone: 'UTC',
          });

          return (
            <View key={day.date} className="flex-1 items-center">
              <View
                className={`w-4 rounded-sm ${day.completed > 0 ? 'bg-brand-ember' : 'bg-core-text-disabled/25'}`}
                style={{ height }}
              />
              <Text className="mt-1.5 text-[9px] text-core-text-disabled">{weekday}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
