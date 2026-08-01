import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useProjectProgress } from '@/hooks/useProjectProgress';
import { MemberAvatar, MemberAvatarStack } from '@/components/ui/MemberAvatar';
import { ProjectProgressPanel } from '@/components/ui/ProjectProgressPanel';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Classification badge ────────────────────────────────────────────────────

const CLASSIFICATION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PROJECT: { label: 'Project', color: '#6B6560', bg: 'bg-core-surface' },
  FEATURE: { label: 'Feature', color: '#C9A84C', bg: 'bg-brand-flax/15' },
  BUG: { label: 'Bug', color: '#D94F3D', bg: 'bg-semantic-danger/10' },
  REFACTOR: { label: 'Refactor', color: '#6A8F7A', bg: 'bg-brand-sage/15' },
  RESEARCH_SPIKE: { label: 'Research', color: '#E8612A', bg: 'bg-brand-ember-mist' },
  PROGRESS_UPDATE: { label: 'Update', color: '#6B6560', bg: 'bg-core-surface' },
};

function ClassificationBadge({ classification }: { classification: string }) {
  const config = CLASSIFICATION_CONFIG[classification] ?? CLASSIFICATION_CONFIG.PROJECT!;
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${config!.bg}`}>
      <Text style={{ color: config!.color }} className="text-xs font-semibold">
        {config!.label}
      </Text>
    </View>
  );
}

function TechChip({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-core-surface px-3 py-1">
      <Text className="text-xs font-medium text-core-text-secondary">{label}</Text>
    </View>
  );
}

// ─── Status icon for timeline ────────────────────────────────────────────────

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'DONE') {
    return (
      <View className="h-7 w-7 items-center justify-center rounded-full bg-semantic-success">
        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
      </View>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-ember">
        <Ionicons name="play" size={12} color="#FFFFFF" />
      </View>
    );
  }
  // TODO
  return (
    <View className="h-7 w-7 items-center justify-center rounded-full border-2 border-core-text-disabled bg-core-background" />
  );
}

// ─── Task timeline node ──────────────────────────────────────────────────────

function TaskNode({
  title,
  status,
  assigneeName,
  isToday,
  isLast,
  onPress,
}: {
  title: string;
  status: string;
  assigneeName: string | null;
  isToday: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const isDone = status === 'DONE';

  return (
    <Pressable onPress={onPress} className="flex-row active:opacity-70">
      {/* Timeline rail */}
      <View className="mr-3 items-center" style={{ width: 28 }}>
        <TaskStatusIcon status={status} />
        {!isLast && (
          <View
            className={`flex-1 w-0.5 ${isDone ? 'bg-semantic-success/30' : 'bg-core-text-disabled/20'}`}
            style={{ minHeight: 24 }}
          />
        )}
      </View>

      {/* Content */}
      <View className={`flex-1 pb-4 ${isLast ? '' : 'mb-1'}`}>
        <View className="flex-row items-center gap-x-2">
          <Text
            className={`flex-1 text-sm font-medium ${isDone ? 'text-core-text-disabled' : 'text-core-text-primary'}`}
            numberOfLines={2}
          >
            {title}
          </Text>
          {isToday && (
            <View className="rounded-full bg-brand-ember-mist px-2 py-0.5">
              <Text className="text-xs font-semibold text-brand-ember">Today</Text>
            </View>
          )}
        </View>

        {/* Unclaimed tasks say so rather than showing nothing — on a shared
            project, an empty slot is a prompt to pick the task up. */}
        <View className="mt-1.5 flex-row items-center gap-x-1.5">
          {assigneeName ? (
            <>
              <MemberAvatar name={assigneeName} size={18} />
              <Text className="text-xs text-core-text-secondary" numberOfLines={1}>
                {assigneeName}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="person-outline" size={12} color="#B0AAA3" />
              <Text className="text-xs text-core-text-disabled">Unassigned</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonDetail() {
  return (
    <View className="px-5 pt-6">
      <View className="h-7 w-3/4 rounded-lg bg-core-text-disabled/20" />
      <View className="mt-3 flex-row gap-2">
        <View className="h-6 w-16 rounded-full bg-core-text-disabled/15" />
        <View className="h-6 w-20 rounded-full bg-core-text-disabled/15" />
      </View>
      <View className="mt-6 h-2 w-full rounded-full bg-core-text-disabled/10" />
      <View className="mt-8">
        {[1, 2, 3, 4].map(i => (
          <View key={i} className="mb-4 flex-row items-center gap-x-3">
            <View className="h-7 w-7 rounded-full bg-core-text-disabled/15" />
            <View className="h-4 flex-1 rounded bg-core-text-disabled/15" />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProjectRoadmapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: project, isLoading, mutate } = useProjectDetail(id);
  const { data: members } = useProjectMembers(id);
  const { data: progress, mutate: mutateProgress } = useProjectProgress(id);
  const [refreshing, setRefreshing] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Assignment and status changes happen on the task detail screen. Without a
  // refetch on return, the roadmap keeps showing the counts from before.
  useFocusEffect(
    useCallback(() => {
      mutate();
      mutateProgress();
    }, [mutate, mutateProgress]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Together, or the bars and the task rows disagree until the next pull.
      await Promise.all([mutate(), mutateProgress()]);
    } catch (error) {
      console.error('[ProjectRoadmap] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [mutate, mutateProgress]);

  const todayStr = new Date().toISOString().split('T')[0];

  const activeTasks = project?.tasks.filter(t => t.status !== 'DONE') ?? [];
  const completedTasks = project?.tasks.filter(t => t.status === 'DONE') ?? [];
  const totalTasks = project?.tasks.length ?? 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  return (
    <Container className="bg-core-background">
      {/* Header bar */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full bg-core-surface active:opacity-70"
        >
          <Ionicons name="arrow-back" size={20} color="#1A1714" />
        </Pressable>

        <Pressable
          onPress={() => router.push(`/project/members?projectId=${id}`)}
          hitSlop={12}
          className="flex-row items-center gap-2 rounded-full bg-core-surface px-3 py-2 active:opacity-70"
        >
          {members.length > 0 ? (
            <MemberAvatarStack names={members.map(m => m.name)} size={24} />
          ) : (
            <Ionicons name="people-outline" size={18} color="#1A1714" />
          )}
        </Pressable>
      </View>

      {isLoading && <SkeletonDetail />}

      {project && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E8612A" />}
        >
          {/* Project title */}
          <Text className="mt-2 font-heading text-2xl leading-tight text-core-text-primary">
            {project.title}
          </Text>

          {/* Classification + tech stack */}
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <ClassificationBadge classification={project.classification} />
            {project.techStack.map(tech => (
              <TechChip key={tech} label={tech} />
            ))}
          </View>

          {/* Progress bar */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-core-text-secondary">
                {completedTasks.length} of {totalTasks} tasks complete
              </Text>
              <Text className="text-xs font-semibold text-brand-ember">
                {progressPercent}%
              </Text>
            </View>
            <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-core-surface-elevated">
              <View
                className="h-full rounded-full bg-brand-ember"
                style={{ width: `${progressPercent}%` }}
              />
            </View>
          </View>

          {/* Per-member breakdown, only once the project is actually shared —
              on a solo project it would just restate the bar above. */}
          {progress && members.length > 1 && <ProjectProgressPanel progress={progress} />}

          {/* Roadmap section label */}
          <View className="mt-8 mb-4 flex-row items-center gap-x-2">
            <Ionicons name="map-outline" size={14} color="#C9A84C" />
            <Text className="text-xs font-semibold uppercase tracking-wide text-brand-flax">
              Roadmap
            </Text>
          </View>

          {/* Active tasks timeline */}
          {activeTasks.map((task, index) => (
            <TaskNode
              key={task.id}
              title={task.title}
              status={task.status}
              assigneeName={task.assigneeName}
              isToday={task.plannedFor === todayStr}
              isLast={index === activeTasks.length - 1 && completedTasks.length === 0}
              onPress={() => router.push(`/task/${task.id}` as any)}
            />
          ))}

          {/* Completed divider */}
          {completedTasks.length > 0 && (
            <View className="mb-2 mt-2">
              <Pressable
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCompletedExpanded(prev => !prev);
                }}
                className="flex-row items-center justify-between px-1 py-2"
              >
                <View className="flex-row items-center gap-x-2">
                  <View className="h-px flex-1 bg-semantic-border" style={{ width: 12 }} />
                  <Text className="font-text text-xs text-core-text-disabled tracking-wide">
                    {completedTasks.length} completed
                  </Text>
                  <View className="h-px flex-1 bg-semantic-border" style={{ width: 12 }} />
                </View>
                <Ionicons
                  name={completedExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#B0AAA3"
                />
              </Pressable>

              {completedExpanded &&
                completedTasks.map((task, index) => (
                  <TaskNode
                    key={task.id}
                    title={task.title}
                    status={task.status}
                    assigneeName={task.assigneeName}
                    isToday={task.plannedFor === todayStr}
                    isLast={index === completedTasks.length - 1}
                    onPress={() => router.push(`/task/${task.id}` as any)}
                  />
                ))}
            </View>
          )}

          {/* Empty state for no tasks */}
          {totalTasks === 0 && (
            <View className="mt-8 items-center px-8">
              <Ionicons name="hourglass-outline" size={36} color="#B0AAA3" />
              <Text className="mt-3 text-center text-sm text-core-text-disabled">
                No tasks yet. Tasks will appear once the AI finishes planning this project.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </Container>
  );
}
