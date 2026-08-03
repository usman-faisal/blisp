import { Avatar } from '@/components/ui/Avatar';
import { Container } from '@/components/ui/Container';
import { CollapsibleHeader } from '@/components/ui/CollapsibleHeader';
import { useCollapsibleHeader } from '@/hooks/useCollapsibleHeader';
import { Animated, View, ActivityIndicator, Pressable, RefreshControl, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaskCard } from '@/components/ui/TaskCard';
import { FloatingInput } from '@/components/FloatingInput';
import { BlurTargetView } from 'expo-blur';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useProfile } from '@/hooks/useProfile';
import { useDailyPlan } from '@/hooks/useDailyPlan';
import Text from '@/components/ui/Text';
import { createBrainDump } from '@/lib/api/brain-dumps';
import { uploadAudioBrainDump } from '@/lib/api/daily-plan';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import type { BrainDumpResponse } from '@repo/types';

const CARD_VARIANTS = ['dark', 'sage', 'ember', 'flax'] as const;

function SubmissionToast({
  visible,
  projectTitle,
  onDismiss,
}: {
  visible: boolean;
  projectTitle: string;
  onDismiss: () => void;
}) {
  const translateY = useRef(new Animated.Value(120)).current;
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
          Animated.timing(translateY, {
            toValue: 120,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => onDismiss());
      }, 5000);

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
        bottom: 110,
        left: 16,
        right: 16,
        zIndex: 50,
      }}
    >
      <View className="overflow-hidden rounded-2xl bg-core-text-primary shadow-card">
        {/* Top row */}
        <View className="flex-row items-start gap-x-3 px-4 pt-4 pb-3">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-ember">
            <Ionicons name="flask" size={16} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-core-background">
              "{projectTitle}" is brewing
            </Text>
            <Text className="mt-0.5 text-xs leading-4 text-core-text-secondary">
              Researching, planning, and fetching resources for you.
            </Text>
          </View>
        </View>

        {/* Progress hint bar */}
        <View className="mx-4 mb-4 h-1 overflow-hidden rounded-full bg-core-text-secondary/20">
          <Animated.View className="h-full rounded-full bg-brand-ember" style={{ width: '30%' }} />
        </View>

        <View className="flex-row items-center gap-x-1.5 border-t border-core-text-secondary/10 px-4 py-3">
          <Ionicons name="egg-outline" size={12} color="#B0AAA3" />
          <Text className="text-xs text-core-text-secondary">
            Check the Incubator tab to track progress
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function FocusScreen() {
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; projectTitle: string }>({
    visible: false,
    projectTitle: '',
  });

  const [isRecording, setIsRecording] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const blurTargetRef = useRef<View | null>(null);
  const { translateY: headerTranslateY, opacity: headerOpacity, onScroll, headerHeight: HEADER_HEIGHT } = useCollapsibleHeader(80);

  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: dailyPlan, isLoading: isPlanLoading, mutate } = useDailyPlan();

  // Re-fetch when returning from task detail so status changes are reflected immediately
  useFocusEffect(
    useCallback(() => {
      mutate();
    }, [mutate]),
  );

  const handleBrainDump = useCallback(async () => {
    if (!query.trim()) return;

    setIsSubmitting(true);
    const capturedQuery = query;
    setQuery('');

    try {
      const result = await createBrainDump(capturedQuery);
      const brainDumpResult = result as BrainDumpResponse;
      const projectTitle = brainDumpResult?.data?.projects?.[0]?.title ?? 'Your idea';

      setToast({ visible: true, projectTitle });
      mutate();
    } catch (error) {
      console.error('Brain dump error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [query, mutate]);

  const dismissToast = useCallback(() => {
    setToast({ visible: false, projectTitle: '' });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        console.warn('[Recording] Microphone permission denied');
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error('[Recording] Failed to start:', err);
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    try {
      setIsRecording(false);
      await recorder.stop();

      await setAudioModeAsync({
        allowsRecording: false,
      });

      const uri = recorder.uri;

      if (uri) {
        await uploadAudioBrainDump(uri);
        mutate();
      }
    } catch (err) {
      console.error('[Recording] Failed to stop:', err);
    }
  }, [isRecording, recorder, mutate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([mutate()]);
    } catch (error) {
      console.error('[FocusScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  return (
    <Container className="bg-core-background">
      <CollapsibleHeader
        translateY={headerTranslateY}
        opacity={headerOpacity}
        height={HEADER_HEIGHT}
        style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
      >
        {/* Notifications moved to the Alerts tab, so the header carries only the
            greeting now. */}
        <View className="flex-row items-center gap-x-3">
          <Avatar uri="https://picsum.photos/id/237/200/300" />
          <View>
            <Text className="font-text text-sm text-core-text-secondary">Welcome back,</Text>
            <Text className="font-heading text-xl text-core-text-primary">
              {profile?.name || 'Explorer'}
            </Text>
          </View>
        </View>
      </CollapsibleHeader>

      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 16, paddingTop: HEADER_HEIGHT }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E8612A" />}
        >
          {/* Section header */}
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="font-heading text-2xl text-core-text-primary">Your focus</Text>
            <Pressable>
              <Text className="font-text text-sm font-medium text-brand-flax">View all</Text>
            </Pressable>
          </View>

          {/* Progress indicator */}
          {dailyPlan && dailyPlan.tasks.length > 0 && (
            <View className="mb-4">
              <Text className="font-text text-xs text-core-text-secondary">
                {dailyPlan.tasks.filter(t => t.status === 'completed').length} of {dailyPlan.tasks.length} done
              </Text>
              <View className="mt-1.5 h-1 overflow-hidden rounded-full bg-core-surface-elevated">
                <View
                  className="h-full rounded-full bg-brand-ember"
                  style={{
                    width: `${Math.round((dailyPlan.tasks.filter(t => t.status === 'completed').length / dailyPlan.tasks.length) * 100)}%`,
                  }}
                />
              </View>
            </View>
          )}

          {/* Morning Briefing */}
          {isPlanLoading && (
            <View className="mb-6 rounded-2xl bg-brand-ember-mist px-4 py-3">
              <View className="flex-row items-center gap-x-2">
                <ActivityIndicator size="small" color="#E8612A" />
                <Text className="font-text text-sm text-core-text-secondary">
                  Preparing your morning briefing…
                </Text>
              </View>
            </View>
          )}

          {dailyPlan?.summary && !isPlanLoading && (
            <View className="mb-6 rounded-2xl bg-brand-ember-mist px-4 py-3">
              <View className="mb-1 flex-row items-center gap-x-2">
                <Ionicons name="sunny-outline" size={16} color="#E8612A" />
                <Text className="font-text text-xs font-semibold uppercase tracking-wide text-brand-ember">
                  Morning Briefing
                </Text>
              </View>
              <Text className="font-text text-sm leading-5 text-core-text-secondary">
                {dailyPlan.summary}
              </Text>
            </View>
          )}

          {/* Skeleton loader while brain-dump is submitting */}
          {isSubmitting && (
            <View className="mb-4 overflow-hidden rounded-3xl bg-core-surface-elevated p-6">
              <View className="flex-row items-center gap-x-3">
                <ActivityIndicator color="#E8612A" />
                <View className="flex-1">
                  <View className="h-4 w-2/3 rounded bg-core-text-disabled/20" />
                  <View className="mt-2 h-3 w-1/2 rounded bg-core-text-disabled/15" />
                </View>
              </View>
              <View className="mt-4 h-1 overflow-hidden rounded-full bg-core-text-disabled/10">
                <View className="h-full w-1/3 rounded-full bg-brand-ember/30" />
              </View>
              <Text className="mt-3 text-xs text-core-text-disabled">
                Processing your brain dump…
              </Text>
            </View>
          )}

          {/* Active task cards (TODO / IN_PROGRESS) */}
          {dailyPlan?.tasks
            .filter(t => t.status !== 'completed')
            .map((task, index) => (
              <TaskCard
                key={task.id}
                title={task.title}
                status={task.status}
                variant={CARD_VARIANTS[index % CARD_VARIANTS.length]}
                onPress={() => router.push(`/task/${task.id}`)}
              />
            ))}

          {/* Completed today collapsible section */}
          {dailyPlan && dailyPlan.tasks.some(t => t.status === 'completed') && (
            <View className="mb-4">
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
                    {dailyPlan.tasks.filter(t => t.status === 'completed').length} completed
                  </Text>
                  <View className="h-px flex-1 bg-semantic-border" style={{ width: 12 }} />
                </View>
              </Pressable>

              {completedExpanded &&
                dailyPlan.tasks
                  .filter(t => t.status === 'completed')
                  .map((task, index) => (
                    <TaskCard
                      key={task.id}
                      title={task.title}
                      status={task.status}
                      variant={CARD_VARIANTS[index % CARD_VARIANTS.length]}
                      onPress={() => router.push(`/task/${task.id}`)}
                    />
                  ))}
            </View>
          )}

          {/* Empty state */}
          {!dailyPlan && !isPlanLoading && (
            <View className="mt-8 items-center px-8">
              <Ionicons name="leaf-outline" size={48} color="#B0AAA3" />
              <Text className="mt-4 text-center font-text text-base text-core-text-secondary">
                No tasks yet. Do a brain dump to get started!
              </Text>
            </View>
          )}
        </Animated.ScrollView>
      </BlurTargetView>

      <FloatingInput
        value={query}
        onChangeText={setQuery}
        onSubmit={handleBrainDump}
        onMicPressIn={startRecording}
        onMicPressOut={stopRecording}
        isRecording={isRecording}
        placeholder="Unload your thoughts..."
        blurTarget={blurTargetRef}
      />

      <SubmissionToast
        visible={toast.visible}
        projectTitle={toast.projectTitle}
        onDismiss={dismissToast}
      />
    </Container>
  );
}