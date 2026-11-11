import Text from '@/components/ui/Text';
import type { ScheduleFitPayload, ShrinkScopeRemedyPayload } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { PriorityChip } from './ProgressBar';

/**
 * Whether the work fits, and what to do when it does not.
 *
 * The two options come from the backend, which applies neither: silently
 * extending past the deadline hides the problem, and silently deferring tasks
 * changes the user's scope without asking. This card presents the arithmetic
 * and lets the user choose.
 */
export function ScheduleFitCard({
  schedule,
  hasDeadline,
  onMoreHours,
  onShrinkScope,
  isSaving,
}: {
  schedule: ScheduleFitPayload;
  hasDeadline: boolean;
  /** Opens the settings sheet so the user can raise their hours. */
  onMoreHours: (requiredHoursPerDay: number) => void;
  onShrinkScope: (remedy: ShrinkScopeRemedyPayload) => void;
  isSaving: boolean;
}) {
  // Without a deadline there is nothing to fit against; show the workload only.
  if (!hasDeadline) {
    return (
      <View className="mt-4 rounded-2xl bg-core-surface/60 p-4">
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="time-outline" size={14} color="#6B6560" />
          <Text className="text-xs text-core-text-secondary">
            About {schedule.remainingHours}h of work left. Set a deadline to see whether it fits.
          </Text>
        </View>
      </View>
    );
  }

  if (schedule.fits) {
    return (
      <View className="mt-4 rounded-2xl bg-semantic-success/5 p-4">
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="checkmark-circle-outline" size={15} color="#4A8C68" />
          <Text className="text-sm font-semibold text-core-text-primary">On track</Text>
        </View>
        <Text className="mt-1.5 text-xs leading-[18px] text-core-text-secondary">
          {schedule.remainingHours}h of work left, and about {schedule.availableHours}h available across{' '}
          {schedule.availableDays} working day{schedule.availableDays === 1 ? '' : 's'}. That already allows
          a fifth of your time for testing and the unexpected.
        </Text>
      </View>
    );
  }

  const hours = schedule.remedies.find((r) => r.kind === 'MORE_HOURS');
  const shrink = schedule.remedies.find((r): r is ShrinkScopeRemedyPayload => r.kind === 'SHRINK_SCOPE');

  return (
    <View className="mt-4 rounded-2xl bg-brand-flax/10 p-4">
      <View className="flex-row items-center gap-x-2">
        <Ionicons name="alert-circle-outline" size={15} color="#C9A84C" />
        <Text className="text-sm font-semibold text-core-text-primary">
          This does not fit your deadline
        </Text>
      </View>

      {/* Plain arithmetic, no judgement. */}
      <Text className="mt-1.5 text-xs leading-[18px] text-core-text-secondary">
        {schedule.remainingHours}h of work left, but only about {schedule.availableHours}h available across{' '}
        {schedule.availableDays} working day{schedule.availableDays === 1 ? '' : 's'} — short by{' '}
        {schedule.overflowHours}h.
      </Text>

      <Text className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
        Two ways forward
      </Text>

      {hours && (
        <Pressable
          onPress={() => onMoreHours(hours.requiredHoursPerDay)}
          disabled={isSaving}
          className={`mt-2 flex-row items-center gap-x-3 rounded-xl bg-core-background p-3 ${
            isSaving ? 'opacity-60' : 'active:opacity-70'
          }`}
        >
          <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-ember-mist">
            <Ionicons name="trending-up-outline" size={15} color="#E8612A" />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-core-text-primary">Put in more hours</Text>
            <Text className="mt-0.5 text-[11px] leading-4 text-core-text-secondary">
              {hours.requiredHoursPerDay}h per working day, up {hours.additionalHoursPerDay}h from now
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color="#B0AAA3" />
        </Pressable>
      )}

      {shrink && (
        <Pressable
          onPress={() => onShrinkScope(shrink)}
          disabled={isSaving}
          className={`mt-2 flex-row items-center gap-x-3 rounded-xl bg-core-background p-3 ${
            isSaving ? 'opacity-60' : 'active:opacity-70'
          }`}
        >
          <View className="h-8 w-8 items-center justify-center rounded-full bg-core-surface">
            <Ionicons name="cut-outline" size={15} color="#6B6560" />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-core-text-primary">Trim the scope</Text>
            <Text className="mt-0.5 text-[11px] leading-4 text-core-text-secondary">
              Set aside {shrink.taskIds.length} lower-priority task
              {shrink.taskIds.length === 1 ? '' : 's'}, saving {shrink.hoursRemoved}h
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color="#B0AAA3" />
        </Pressable>
      )}

      {/* Shown when cutting everything optional still would not fit: the
          backend withholds that option rather than suggesting one that fails. */}
      {!shrink && (
        <Text className="mt-2 text-[11px] leading-4 text-core-text-secondary">
          Trimming is not offered here because the remaining work is all marked must-have. More hours, or a
          later deadline, are the honest options.
        </Text>
      )}
    </View>
  );
}

/**
 * Confirmation preview for a scope cut.
 *
 * Lists exactly which tasks will be set aside before anything happens — the
 * plan requires rescheduling to be confirmed, and a silent change to approved
 * scope is the thing this guards against.
 */
export function ShrinkScopeSheet({
  visible,
  remedy,
  isSaving,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  remedy: ShrinkScopeRemedyPayload | null;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (taskIds: string[]) => void;
}) {
  if (!remedy) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-core-background px-5 pb-10 pt-5">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-xl text-core-text-primary">Trim the scope</Text>
            <Pressable onPress={onCancel} hitSlop={12} className="active:opacity-60">
              <Ionicons name="close" size={22} color="#6B6560" />
            </Pressable>
          </View>

          <Text className="mt-2 text-[13px] leading-5 text-core-text-secondary">
            These {remedy.taskIds.length} task{remedy.taskIds.length === 1 ? '' : 's'} will be set aside,
            saving about {remedy.hoursRemoved}h. They stay on the project and can be brought back at any
            time — nothing is deleted, and they stop counting against your progress.
          </Text>

          <ScrollView className="mt-4" style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
            {remedy.tasks.map((task) => (
              <View key={task.id} className="mt-2 flex-row items-center gap-x-2 rounded-xl bg-core-surface p-3">
                <Ionicons name="arrow-down-circle-outline" size={14} color="#6B6560" />
                <Text className="flex-1 text-[13px] text-core-text-primary" numberOfLines={2}>
                  {task.title}
                </Text>
                <PriorityChip priority={task.priority} />
              </View>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => onConfirm(remedy.taskIds)}
            disabled={isSaving}
            className={`mt-5 flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3.5 ${
              isSaving ? 'opacity-60' : 'active:opacity-80'
            }`}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
            <Text className="text-sm font-semibold text-white">
              {isSaving ? 'Updating…' : `Set aside ${remedy.taskIds.length}`}
            </Text>
          </Pressable>

          <Pressable onPress={onCancel} className="mt-2 items-center py-3 active:opacity-60">
            <Text className="text-[13px] text-core-text-secondary">Keep everything</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
