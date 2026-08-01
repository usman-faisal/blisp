import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { useTaskDetail } from '@/hooks/useTaskDetail';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { AssigneePicker } from '@/components/ui/AssigneePicker';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { updateTaskStatus } from '@/lib/api/tasks';
import { assignTask } from '@/lib/api/collaboration';
import { archiveProject } from '@/lib/api/projects';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG = {
  TODO: {
    label: 'To Do',
    icon: 'ellipse-outline' as const,
    bg: 'bg-core-surface',
    activeBg: 'bg-core-text-primary',
    text: 'text-core-text-secondary',
    activeText: 'text-core-background',
    color: '#6B6560',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: 'play-circle-outline' as const,
    bg: 'bg-brand-ember-mist',
    activeBg: 'bg-brand-ember',
    text: 'text-brand-ember',
    activeText: 'text-white',
    color: '#E8612A',
  },
  DONE: {
    label: 'Done',
    icon: 'checkmark-circle-outline' as const,
    bg: 'bg-semantic-success/10',
    activeBg: 'bg-semantic-success',
    text: 'text-semantic-success',
    activeText: 'text-white',
    color: '#4A8C68',
  },
} as const;

type TaskStatusKey = keyof typeof STATUS_CONFIG;

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusPill({
  statusKey,
  isActive,
  onPress,
  disabled,
}: {
  statusKey: TaskStatusKey;
  isActive: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const config = STATUS_CONFIG[statusKey];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-x-1.5 rounded-full px-4 py-2.5 ${isActive ? config.activeBg : config.bg} active:opacity-70`}
    >
      <Ionicons
        name={config.icon}
        size={16}
        color={isActive ? '#FFFFFF' : config.color}
      />
      <Text
        className={`text-xs font-semibold ${isActive ? config.activeText : config.text}`}
      >
        {config.label}
      </Text>
    </Pressable>
  );
}

function TechChip({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-core-surface px-3 py-1">
      <Text className="text-xs font-medium text-core-text-secondary">
        {label}
      </Text>
    </View>
  );
}

function ResourceCard({
  title,
  summary,
  url,
}: {
  title: string;
  summary: string | null;
  url: string;
}) {
  const handleOpen = useCallback(() => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open this link.'),
    );
  }, [url]);

  return (
    <Pressable
      onPress={handleOpen}
      className="rounded-2xl bg-core-surface p-4 active:opacity-70"
    >
      <View className="flex-row items-start gap-x-3">
        <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-brand-flax/15">
          <Ionicons name="document-text-outline" size={16} color="#C9A84C" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-core-text-primary" numberOfLines={2}>
            {title}
          </Text>
          {summary && (
            <Text className="mt-1 text-xs leading-4 text-core-text-secondary" numberOfLines={3}>
              {summary}
            </Text>
          )}
          <View className="mt-2 flex-row items-center gap-x-1">
            <Ionicons name="open-outline" size={12} color="#6B6560" />
            <Text className="text-xs text-core-text-disabled" numberOfLines={1}>
              {url.replace(/^https?:\/\//, '').split('/')[0]}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SkeletonDetail() {
  return (
    <View className="px-5 pt-6">
      <View className="h-7 w-3/4 rounded-lg bg-core-text-disabled/20" />
      <View className="mt-6 flex-row gap-3">
        <View className="h-10 w-24 rounded-full bg-core-text-disabled/15" />
        <View className="h-10 w-28 rounded-full bg-core-text-disabled/15" />
        <View className="h-10 w-20 rounded-full bg-core-text-disabled/15" />
      </View>
      <View className="mt-8 h-4 w-20 rounded bg-core-text-disabled/20" />
      <View className="mt-3 h-16 w-full rounded-2xl bg-core-text-disabled/10" />
      <View className="mt-8 h-4 w-24 rounded bg-core-text-disabled/20" />
      <View className="mt-3 h-20 w-full rounded-2xl bg-core-text-disabled/10" />
      <View className="mt-3 h-20 w-full rounded-2xl bg-core-text-disabled/10" />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Screen                                                             */
/* ------------------------------------------------------------------ */

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: task, isLoading, mutate } = useTaskDetail(id);

  const { data: members } = useProjectMembers(task?.project.id ?? '');

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Optimistic assignee, mirroring the status handling below. `undefined` means
  // "no pending change" — null is a real value here, meaning unassigned.
  const [optimisticAssignee, setOptimisticAssignee] = useState<
    { id: string | null; name: string | null } | undefined
  >(undefined);

  const assigneeId = optimisticAssignee ? optimisticAssignee.id : (task?.assigneeId ?? null);
  const assigneeName = optimisticAssignee
    ? optimisticAssignee.name
    : (task?.assigneeName ?? null);

  // Optimistic status so the UI feels instant
  const [optimisticStatus, setOptimisticStatus] = useState<TaskStatusKey | null>(null);
  const currentStatus = optimisticStatus ?? (task?.status as TaskStatusKey);

  // Sync optimistic state when real data arrives
  useEffect(() => {
    if (task) {
      setOptimisticStatus(null);
      setOptimisticAssignee(undefined);
    }
  }, [task]);

  /* --- Assignment ---------------------------------------------------- */
  const handleAssign = useCallback(
    async (nextAssigneeId: string | null) => {
      if (!task) return;

      setIsPickerOpen(false);
      if (nextAssigneeId === assigneeId) return;

      const previous = optimisticAssignee;
      const nextName =
        nextAssigneeId === null
          ? null
          : (members.find((m) => m.userId === nextAssigneeId)?.name ?? null);

      setOptimisticAssignee({ id: nextAssigneeId, name: nextName });
      setIsAssigning(true);
      try {
        await assignTask(task.id, nextAssigneeId);
        mutate();
      } catch (error: any) {
        console.error('[TaskDetail] Assign error:', error);
        setOptimisticAssignee(previous); // revert
        Alert.alert(
          'Could not assign',
          error?.response?.data?.message ?? 'Something went wrong. Please try again.',
        );
      } finally {
        setIsAssigning(false);
      }
    },
    [task, assigneeId, optimisticAssignee, members, mutate],
  );

  /* --- Status change ------------------------------------------------ */
  const handleStatusChange = useCallback(
    async (newStatus: TaskStatusKey) => {
      if (!task || newStatus === currentStatus) return;

      setOptimisticStatus(newStatus);
      setIsUpdatingStatus(true);
      try {
        await updateTaskStatus(task.id, newStatus);
        mutate();
      } catch (error) {
        console.error('[TaskDetail] Status update error:', error);
        setOptimisticStatus(null); // revert
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [task, currentStatus, mutate],
  );

  /* --- Archive project ---------------------------------------------- */
  const handleArchiveProject = useCallback(() => {
    if (!task) return;
    Alert.alert(
      'Archive Project',
      `Are you sure you want to archive "${task.project.title}"? Its tasks will no longer appear in daily plans.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setIsArchiving(true);
            try {
              await archiveProject(task.project.id);
              router.back();
            } catch (error) {
              console.error('[TaskDetail] Archive error:', error);
              Alert.alert('Error', 'Could not archive the project. Try again.');
            } finally {
              setIsArchiving(false);
            }
          },
        },
      ],
    );
  }, [task, router]);

  /* --- Refresh ------------------------------------------------------- */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([mutate()]);
    } catch (error) {
      console.error('[TaskDetailScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  return (
    <Container className="bg-core-background">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full bg-core-surface active:opacity-70"
        >
          <Ionicons name="arrow-back" size={20} color="#1A1714" />
        </Pressable>

        {task && (
          <Pressable
            onPress={handleArchiveProject}
            disabled={isArchiving}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-core-surface active:opacity-70"
          >
            {isArchiving ? (
              <ActivityIndicator size="small" color="#D94F3D" />
            ) : (
              <Ionicons name="archive-outline" size={20} color="#D94F3D" />
            )}
          </Pressable>
        )}
      </View>

      {/* ── Loading state ───────────────────────────────────────────── */}
      {isLoading && <SkeletonDetail />}

      {/* ── Content ─────────────────────────────────────────────────── */}
      {task && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E8612A" />}
        >
          {/* Task title */}
          <Text className="mt-2 font-heading text-2xl leading-tight text-core-text-primary">
            {task.title}
          </Text>

          {/* Project badge */}
          <View className="mt-3 flex-row items-center gap-x-2">
            <View className="h-5 w-5 items-center justify-center rounded bg-brand-flax/20">
              <Ionicons name="folder-outline" size={12} color="#C9A84C" />
            </View>
            <Text className="text-xs font-medium text-core-text-secondary">
              {task.project.title}
            </Text>
          </View>

          {/* ── Assignee ────────────────────────────────────────────── */}
          <View className="mt-6">
            <Text className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-core-text-disabled">
              Assigned to
            </Text>

            <Pressable
              onPress={() => setIsPickerOpen(true)}
              disabled={isAssigning}
              className="flex-row items-center gap-3 rounded-2xl bg-core-surface p-3 active:opacity-70">
              {assigneeName ? (
                <MemberAvatar name={assigneeName} size={36} />
              ) : (
                <View className="h-9 w-9 items-center justify-center rounded-full bg-core-surface-elevated">
                  <Ionicons name="person-outline" size={18} color="#6B6560" />
                </View>
              )}

              <View className="flex-1">
                <Text
                  className={`text-sm font-semibold ${
                    assigneeName ? 'text-core-text-primary' : 'text-core-text-secondary'
                  }`}>
                  {assigneeName ?? 'Unassigned'}
                </Text>
                <Text className="text-xs text-core-text-disabled">
                  {assigneeName ? 'Tap to reassign' : 'Tap to claim this task'}
                </Text>
              </View>

              {isAssigning ? (
                <ActivityIndicator size="small" color="#E8612A" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#B0AAA3" />
              )}
            </Pressable>
          </View>

          {/* ── Status selector ─────────────────────────────────────── */}
          <View className="mt-6">
            <Text className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-core-text-disabled">
              Status
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(Object.keys(STATUS_CONFIG) as TaskStatusKey[]).map((key) => (
                <StatusPill
                  key={key}
                  statusKey={key}
                  isActive={currentStatus === key}
                  onPress={() => handleStatusChange(key)}
                  disabled={isUpdatingStatus}
                />
              ))}
            </View>
          </View>

          {/* ── Resources ───────────────────────────────────────────── */}
          <View className="mt-8">
            <View className="mb-2.5 flex-row items-center gap-x-2">
              <Ionicons name="sparkles-outline" size={14} color="#C9A84C" />
              <Text className="text-xs font-semibold uppercase tracking-wide text-brand-flax">
                Resources
              </Text>
              <View className="rounded-full bg-brand-flax/15 px-2 py-0.5">
                <Text className="text-xs font-semibold text-brand-flax">
                  {task.resources.length}
                </Text>
              </View>
            </View>

            {task.resources.length > 0 ? (
              <View className="gap-3">
                {task.resources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    title={resource.title}
                    summary={resource.summary}
                    url={resource.url}
                  />
                ))}
              </View>
            ) : (
              <View className="items-center rounded-2xl bg-core-surface py-8 px-6">
                <Ionicons name="hourglass-outline" size={28} color="#B0AAA3" />
                <Text className="mt-2 text-center text-sm text-core-text-disabled">
                  Resources will appear here once the AI finishes researching this task.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <AssigneePicker
        visible={isPickerOpen}
        members={members}
        selectedId={assigneeId}
        onSelect={handleAssign}
        onClose={() => setIsPickerOpen(false)}
      />
    </Container>
  );
}
