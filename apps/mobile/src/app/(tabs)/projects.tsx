import { Container } from '@/components/ui/Container';
import { CollapsibleHeader } from '@/components/ui/CollapsibleHeader';
import { useCollapsibleHeader } from '@/hooks/useCollapsibleHeader';
import Text from '@/components/ui/Text';
import { useActiveProjects, ActiveProject } from '@/hooks/useActiveProjects';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { View, Pressable, Animated, RefreshControl } from 'react-native';

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

// ─── Tech chip ───────────────────────────────────────────────────────────────

function TechChip({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-core-surface px-3 py-1">
      <Text className="text-xs font-medium text-core-text-secondary">{label}</Text>
    </View>
  );
}

// ─── Project card ────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onPress,
}: {
  project: ActiveProject;
  onPress: () => void;
}) {
  const { taskCounts } = project;
  const progressPercent =
    taskCounts.total > 0
      ? Math.round((taskCounts.done / taskCounts.total) * 100)
      : 0;

  return (
    <Pressable
      onPress={onPress}
      className="mb-4 overflow-hidden rounded-3xl bg-core-surface-elevated p-5 active:opacity-70"
    >
      {/* Title row + classification badge */}
      <View className="flex-row items-start justify-between gap-x-3">
        <Text className="flex-1 font-heading text-lg text-core-text-primary">
          {project.title}
        </Text>
        <ClassificationBadge classification={project.classification} />
      </View>

      {/* Tech stack chips */}
      {project.techStack.length > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {project.techStack.map((tech) => (
            <TechChip key={tech} label={tech} />
          ))}
        </View>
      )}

      {/* Progress bar */}
      <View className="mt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-core-text-secondary">
            {taskCounts.done} of {taskCounts.total} tasks
          </Text>
          <Text className="text-xs font-semibold text-core-text-secondary">
            {progressPercent}%
          </Text>
        </View>
        <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-core-surface">
          <View
            className="h-full rounded-full bg-brand-ember"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
      </View>

      {/* Tap hint */}
      <View className="mt-3 flex-row items-center gap-x-1.5">
        <Ionicons name="map-outline" size={14} color="#6B6560" />
        <Text className="text-xs text-core-text-disabled">View roadmap</Text>
      </View>
    </Pressable>
  );
}

// ─── Skeleton & empty state ──────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View className="mb-4 overflow-hidden rounded-3xl bg-core-surface-elevated p-5">
      <View className="h-5 w-3/4 rounded-lg bg-core-text-disabled/20" />
      <View className="mt-3 flex-row gap-2">
        <View className="h-6 w-16 rounded-full bg-core-text-disabled/15" />
        <View className="h-6 w-20 rounded-full bg-core-text-disabled/15" />
        <View className="h-6 w-14 rounded-full bg-core-text-disabled/15" />
      </View>
      <View className="mt-4 h-4 w-1/3 rounded bg-core-text-disabled/15" />
      <View className="mt-2 h-1.5 w-full rounded-full bg-core-text-disabled/10" />
    </View>
  );
}

function EmptyState() {
  return (
    <View className="mt-16 items-center px-10">
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-core-surface">
        <Ionicons name="rocket-outline" size={40} color="#B0AAA3" />
      </View>
      <Text className="text-center font-heading text-xl text-core-text-primary">
        No active projects yet
      </Text>
      <Text className="mt-2 text-center text-sm leading-5 text-core-text-secondary">
        Head to the Incubator tab to activate a project once it's been researched and planned.
      </Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProjectsScreen() {
  const { data: projects, isLoading, mutate } = useActiveProjects();
  const { translateY: headerTranslateY, opacity: headerOpacity, onScroll, headerHeight } = useCollapsibleHeader(110);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      mutate();
    }, [mutate]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutate();
    } catch (error) {
      console.error('[ProjectsScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  return (
    <Container className="bg-core-background">
      <CollapsibleHeader
        translateY={headerTranslateY}
        opacity={headerOpacity}
        height={headerHeight}
        style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
      >
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="rocket" size={20} color="#E8612A" />
          <Text className="text-xs font-semibold uppercase tracking-widest text-brand-ember">
            Projects
          </Text>
        </View>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="font-heading text-3xl text-core-text-primary">My Projects</Text>

          <Pressable
            onPress={() => router.push('/invite')}
            hitSlop={12}
            className="flex-row items-center gap-1.5 rounded-full bg-core-surface px-3 py-2 active:opacity-70">
            <Ionicons name="enter-outline" size={16} color="#E8612A" />
            <Text className="text-xs font-semibold text-brand-ember">Join</Text>
          </Pressable>
        </View>

        <Text className="mt-1 text-sm text-core-text-secondary">
          Active projects you're working on.
        </Text>
      </CollapsibleHeader>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: headerHeight }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E8612A" />}
      >
        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!isLoading &&
          projects &&
          projects.length > 0 &&
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onPress={() => router.push(`/project/${project.id}` as any)}
            />
          ))}

        {!isLoading && (!projects || projects.length === 0) && <EmptyState />}
      </Animated.ScrollView>
    </Container>
  );
}
