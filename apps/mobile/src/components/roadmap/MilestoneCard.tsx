import Text from '@/components/ui/Text';
import type { MilestonePayload, RoadmapTaskPayload } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';
import { EffortBadge, PriorityChip, ProgressBar } from './ProgressBar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Short date for a milestone target; the year is noise within a few months. */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function StatusDot({ status }: { status: RoadmapTaskPayload['status'] }) {
  if (status === 'DONE') {
    return (
      <View className="h-5 w-5 items-center justify-center rounded-full bg-semantic-success">
        <Ionicons name="checkmark" size={11} color="#FFFFFF" />
      </View>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-ember">
        <Ionicons name="play" size={9} color="#FFFFFF" />
      </View>
    );
  }
  // Set-aside work is visually quieter than outstanding work, but still shown.
  if (status === 'DEFERRED' || status === 'CANCELLED') {
    return (
      <View className="h-5 w-5 items-center justify-center rounded-full bg-core-surface-elevated">
        <Ionicons name="remove" size={11} color="#B0AAA3" />
      </View>
    );
  }
  return <View className="h-5 w-5 rounded-full border-2 border-core-text-disabled bg-core-background" />;
}

export function TaskRow({
  task,
  onPress,
  onRestore,
}: {
  task: RoadmapTaskPayload;
  onPress?: () => void;
  onRestore?: () => void;
}) {
  const isSetAside = task.status === 'DEFERRED' || task.status === 'CANCELLED';
  const isDone = task.status === 'DONE';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`mt-2 flex-row items-center gap-x-2.5 rounded-xl bg-core-background p-3 ${
        onPress ? 'active:opacity-70' : ''
      }`}
    >
      <StatusDot status={task.status} />

      <View className="flex-1">
        <Text
          className={`text-[13px] leading-[18px] ${
            isDone || isSetAside ? 'text-core-text-disabled' : 'text-core-text-primary'
          }`}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {isSetAside && (
          <Text className="mt-0.5 text-[10px] text-core-text-disabled">
            Set aside — not counted in progress
          </Text>
        )}
      </View>

      {/* Bringing work back is offered inline: a deferred task the user cannot
          find again may as well have been deleted. */}
      {isSetAside && onRestore ? (
        <Pressable onPress={onRestore} hitSlop={8} className="active:opacity-60">
          <Ionicons name="arrow-undo-outline" size={15} color="#6A8F7A" />
        </Pressable>
      ) : (
        <View className="flex-row items-center gap-x-1.5">
          <PriorityChip priority={task.priority} />
          <EffortBadge effort={task.effort} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * One milestone, collapsible.
 *
 * Collapsed by default except the first incomplete one: a roadmap with every
 * milestone expanded is several screens of scrolling, and the milestone being
 * worked on is the one that matters.
 */
export function MilestoneCard({
  milestone,
  defaultExpanded,
  isOverdue,
  onTaskPress,
  onRestoreTask,
}: {
  milestone: MilestonePayload;
  defaultExpanded: boolean;
  isOverdue: boolean;
  onTaskPress?: (taskId: string) => void;
  onRestoreTask?: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const target = shortDate(milestone.targetDate);
  const isComplete = milestone.progress.total > 0 && milestone.progress.percentComplete === 100;

  return (
    <View className="mt-3 overflow-hidden rounded-2xl bg-core-surface/60">
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded((prev) => !prev);
        }}
        className="px-4 py-3.5 active:opacity-70"
      >
        <View className="flex-row items-center gap-x-2.5">
          <View
            className={`h-6 w-6 items-center justify-center rounded-full ${
              isComplete ? 'bg-semantic-success' : 'bg-core-surface-elevated'
            }`}
          >
            {isComplete ? (
              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
            ) : (
              <Text className="text-[10px] font-semibold text-core-text-secondary">{milestone.position}</Text>
            )}
          </View>

          <Text className="flex-1 text-sm font-semibold text-core-text-primary" numberOfLines={1}>
            {milestone.title}
          </Text>

          {target && (
            <View className={`rounded-md px-2 py-0.5 ${isOverdue ? 'bg-semantic-danger/10' : 'bg-core-surface'}`}>
              <Text
                style={{ color: isOverdue ? '#D94F3D' : '#6B6560' }}
                className="text-[10px] font-semibold"
              >
                {target}
              </Text>
            </View>
          )}

          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#B0AAA3" />
        </View>

        <View className="mt-2.5">
          <ProgressBar progress={milestone.progress} compact />
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4">
          {milestone.tasks.length === 0 ? (
            <Text className="mt-2 text-xs text-core-text-disabled">No tasks in this milestone.</Text>
          ) : (
            milestone.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onPress={onTaskPress ? () => onTaskPress(task.id) : undefined}
                onRestore={onRestoreTask ? () => onRestoreTask(task.id) : undefined}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}
