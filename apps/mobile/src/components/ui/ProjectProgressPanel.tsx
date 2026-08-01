import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import type { ProjectProgressPayload } from '@repo/types';
import { MemberAvatar } from './MemberAvatar';
import Text from './Text';

/**
 * Per-member completion, shown under the roadmap's overall bar.
 *
 * Members with nothing assigned still appear: on a shared project, "nobody has
 * given Sara anything yet" is worth seeing, and hiding the row hides it.
 */
export function ProjectProgressPanel({ progress }: { progress: ProjectProgressPayload }) {
  const { perMember, unassigned } = progress;

  return (
    <View className="mt-6">
      <View className="mb-3 flex-row items-center gap-x-2">
        <Ionicons name="people-outline" size={14} color="#6A8F7A" />
        <Text className="text-xs font-semibold uppercase tracking-wide text-brand-sage">
          Who is doing what
        </Text>
      </View>

      {perMember.map((member) => {
        const percent =
          member.assigned > 0 ? Math.round((member.done / member.assigned) * 100) : 0;

        return (
          <View key={member.userId} className="mb-3 flex-row items-center gap-3">
            <MemberAvatar name={member.name} size={32} />

            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-core-text-primary" numberOfLines={1}>
                  {member.name}
                </Text>
                <Text className="text-xs text-core-text-secondary">
                  {member.assigned === 0
                    ? 'No tasks yet'
                    : `${member.done}/${member.assigned} done`}
                </Text>
              </View>

              <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-core-surface-elevated">
                <View
                  className="h-full rounded-full bg-semantic-success"
                  style={{ width: `${percent}%` }}
                />
              </View>

              {member.inProgress > 0 && (
                <Text className="mt-1 text-xs text-brand-ember">
                  {member.inProgress} in progress
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {unassigned > 0 && (
        <View className="mt-1 flex-row items-center gap-3">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-core-surface">
            <Ionicons name="albums-outline" size={16} color="#6B6560" />
          </View>
          <Text className="text-sm text-core-text-secondary">
            {unassigned} {unassigned === 1 ? 'task' : 'tasks'} unclaimed
          </Text>
        </View>
      )}
    </View>
  );
}
