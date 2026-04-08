import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { useIncubatorProjects, IncubatorProject } from '@/hooks/useIncubatorProjects';
import { useProjectPipeline } from '@/hooks/useProjectPipeline';
import { activateProject } from '@/lib/api/projects';
import { PipelineProgress } from '@/components/PipelineProgress';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from 'react-native';

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  visible,
  onDismiss,
}: {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 100, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => onDismiss());
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible, translateY, opacity, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
        position: 'absolute',
        bottom: 32,
        left: 20,
        right: 20,
        zIndex: 50,
      }}
      className="rounded-2xl bg-core-text-primary px-5 py-4 shadow-card"
    >
      <View className="flex-row items-center gap-x-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-sage">
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        </View>
        <Text className="flex-1 text-sm leading-5 text-core-background">{message}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Tech chip ────────────────────────────────────────────────────────────────

function TechChip({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-core-surface px-3 py-1">
      <Text className="text-xs font-medium text-core-text-secondary">{label}</Text>
    </View>
  );
}

// ─── Pipeline-aware project card ──────────────────────────────────────────────

/**
 * Each card polls its own pipeline independently.
 * While processing → shows PipelineProgress.
 * Once complete (or never had events) → shows the normal ProjectCard.
 */
function IncubatorCard({
  project,
  onActivate,
  isActivating,
}: {
  project: IncubatorProject;
  onActivate: (id: string) => void;
  isActivating: boolean;
}) {
  const { data: pipeline, isLoading: isPipelineLoading, isComplete } = useProjectPipeline(project.id);

  const hasEvents = (pipeline?.events.length ?? 0) > 0;
  const isProcessing = hasEvents && !isComplete;

  // While pipeline data is loading for the first time, show a subtle skeleton
  if (isPipelineLoading) {
    return <SkeletonCard />;
  }

  // Project is still being processed — show pipeline view
  if (isProcessing) {
    return (
      <PipelineProgress
        events={pipeline!.events}
        projectTitle={project.title}
      />
    );
  }

  // Done (or no pipeline events) — show the full project card
  return (
    <View className="mb-4 overflow-hidden rounded-3xl bg-core-surface-elevated p-5">
      {/* Title & description */}
      <Text className="font-heading text-lg text-core-text-primary">{project.title}</Text>
      <Text className="mt-1.5 text-sm leading-5 text-core-text-secondary">
        {project.description}
      </Text>

      {/* Tech stack chips */}
      <View className="mt-3 flex-row flex-wrap gap-2">
        {project.techStack.map((tech) => (
          <TechChip key={tech} label={tech} />
        ))}
      </View>

      {/* Research summary */}
      {project.resources.length > 0 && (
        <View className="mt-4 rounded-2xl bg-core-surface p-4">
          <View className="mb-2 flex-row items-center gap-x-2">
            <Ionicons name="sparkles-outline" size={14} color="#C9A84C" />
            <Text className="text-xs font-semibold uppercase tracking-wide text-brand-flax">
              Research Summary
            </Text>
          </View>
          {project.resources.map((resource, idx) => (
            <View
              key={resource.id}
              className={idx > 0 ? 'mt-3 border-t border-semantic-border pt-3' : ''}
            >
              <Text className="text-xs font-semibold text-core-text-primary">
                {resource.title}
              </Text>
              <Text
                className="mt-1 text-xs leading-4 text-core-text-secondary"
                numberOfLines={3}
              >
                {resource.summary}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Activate button */}
      <Pressable
        onPress={() => onActivate(project.id)}
        disabled={isActivating}
        className="mt-4 flex-row items-center justify-center gap-x-2 rounded-2xl bg-brand-flax/15 py-3.5 active:opacity-70"
      >
        {isActivating ? (
          <ActivityIndicator size="small" color="#C9A84C" />
        ) : (
          <>
            <Ionicons name="rocket-outline" size={16} color="#C9A84C" />
            <Text className="text-sm font-semibold text-brand-flax">Activate Project</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ─── Skeleton & empty state ───────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View className="mb-4 overflow-hidden rounded-3xl bg-core-surface-elevated p-5">
      <View className="h-5 w-3/4 rounded-lg bg-core-text-disabled/20" />
      <View className="mt-3 h-4 w-full rounded-lg bg-core-text-disabled/15" />
      <View className="mt-1.5 h-4 w-5/6 rounded-lg bg-core-text-disabled/15" />
      <View className="mt-4 flex-row gap-2">
        <View className="h-6 w-16 rounded-full bg-core-text-disabled/15" />
        <View className="h-6 w-20 rounded-full bg-core-text-disabled/15" />
        <View className="h-6 w-14 rounded-full bg-core-text-disabled/15" />
      </View>
      <View className="mt-4 h-24 w-full rounded-2xl bg-core-text-disabled/10" />
      <View className="mt-4 h-12 w-full rounded-2xl bg-core-text-disabled/10" />
    </View>
  );
}

function EmptyState() {
  return (
    <View className="mt-16 items-center px-10">
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-core-surface">
        <Ionicons name="egg-outline" size={40} color="#B0AAA3" />
      </View>
      <Text className="text-center font-heading text-xl text-core-text-primary">
        No ideas incubating yet
      </Text>
      <Text className="mt-2 text-center text-sm leading-5 text-core-text-secondary">
        Record a brain dump to start. Your AI co-pilot will research and plan projects for you.
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function IncubatorScreen() {
  const { data: projects, isLoading, mutate, startPolling, stopPolling } = useIncubatorProjects();
  const [activatingId, setActivatingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      mutate();
      startPolling();
      return stopPolling;
    }, [mutate, startPolling, stopPolling]),
  );
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });

  const handleActivate = useCallback(
    async (projectId: string) => {
      setActivatingId(projectId);
      try {
        await activateProject(projectId);
        setRemovedIds((prev) => new Set(prev).add(projectId));
        setToast({
          visible: true,
          message: 'Added to your focus. Tasks will appear in your next daily plan.',
        });
      } catch (error) {
        console.error('[Incubator] Activation failed:', error);
        setToast({ visible: true, message: 'Something went wrong. Please try again.' });
      } finally {
        setActivatingId(null);
      }
    },
    [mutate],
  );

  const dismissToast = useCallback(() => {
    setToast({ visible: false, message: '' });
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([mutate()]);
    } catch (error) {
      console.error('[IncubatorScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  const visibleProjects = projects?.filter((p) => !removedIds.has(p.id));

  return (
    <Container className="bg-core-background px-4">
      {/* Header */}
      <View className="mt-4 mb-2">
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="egg" size={20} color="#C9A84C" />
          <Text className="text-xs font-semibold uppercase tracking-widest text-brand-flax">
            Incubator
          </Text>
        </View>
        <Text className="mt-1 font-heading text-3xl text-core-text-primary">Ideas Brewing</Text>
        <Text className="mt-1 text-sm text-core-text-secondary">
          Projects researched and planned by your AI co-pilot.
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        className="mt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#C9A84C" />}
      >
        {/* Loading state (initial fetch) */}
        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* Pipeline-aware project cards */}
        {!isLoading &&
          visibleProjects &&
          visibleProjects.length > 0 &&
          visibleProjects.map((project) => (
            <IncubatorCard
              key={project.id}
              project={project}
              onActivate={handleActivate}
              isActivating={activatingId === project.id}
            />
          ))}

        {/* Empty state */}
        {!isLoading && (!visibleProjects || visibleProjects.length === 0) && <EmptyState />}
      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} onDismiss={dismissToast} />
    </Container>
  );
}
