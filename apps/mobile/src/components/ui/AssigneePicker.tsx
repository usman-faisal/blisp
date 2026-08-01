import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import type { ProjectMemberResponse } from '@repo/types';
import { MemberAvatar } from './MemberAvatar';
import Text from './Text';

interface AssigneePickerProps {
  visible: boolean;
  members: ProjectMemberResponse[];
  /** Currently assigned member, or null for the shared backlog. */
  selectedId: string | null;
  onSelect: (assigneeId: string | null) => void;
  onClose: () => void;
}

/**
 * Bottom sheet for choosing who owns a task.
 *
 * "Unassigned" is a first-class choice rather than a way to cancel: returning a
 * task to the shared backlog is a real action, not the absence of one.
 */
export function AssigneePicker({
  visible,
  members,
  selectedId,
  onSelect,
  onClose,
}: AssigneePickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tapping the scrim dismisses, which is what a sheet is expected to do. */}
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        {/* Swallow taps on the sheet itself so they do not reach the scrim. */}
        <Pressable onPress={() => {}} className="rounded-t-3xl bg-core-background pb-8 pt-2">
          <View className="mb-2 items-center">
            <View className="h-1 w-10 rounded-full bg-core-text-disabled/40" />
          </View>

          <Text className="px-5 pb-3 pt-2 font-heading text-xl text-core-text-primary">
            Assign task
          </Text>

          <ScrollView style={{ maxHeight: 340 }}>
            {members.map((member) => {
              const isSelected = member.userId === selectedId;
              return (
                <Pressable
                  key={member.userId}
                  onPress={() => onSelect(member.userId)}
                  className="flex-row items-center gap-3 px-5 py-3 active:opacity-70">
                  <MemberAvatar name={member.name} size={38} />

                  <View className="flex-1">
                    <Text className="font-semibold text-core-text-primary">
                      {member.name}
                      {member.isSelf ? ' (you)' : ''}
                    </Text>
                    <Text className="text-xs text-core-text-secondary">{member.email}</Text>
                  </View>

                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#E8612A" />
                  )}
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => onSelect(null)}
              className="flex-row items-center gap-3 px-5 py-3 active:opacity-70">
              <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-core-surface">
                <Ionicons name="person-outline" size={18} color="#6B6560" />
              </View>

              <View className="flex-1">
                <Text className="font-semibold text-core-text-primary">Unassigned</Text>
                <Text className="text-xs text-core-text-secondary">
                  Return this task to the shared backlog
                </Text>
              </View>

              {selectedId === null && (
                <Ionicons name="checkmark-circle" size={22} color="#E8612A" />
              )}
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
