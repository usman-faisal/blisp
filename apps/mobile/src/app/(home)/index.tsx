import { Avatar } from '@/components/ui/Avatar';
import { Container } from '@/components/ui/Container';
import { Stack } from 'expo-router';
import { ScrollView, View, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaskCard } from '@/components/ui/TaskCard';
import { FloatingInput } from '@/components/FloatingInput';
import { BlurTargetView } from 'expo-blur';
import { useState, useRef, useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useDailyPlan } from '@/hooks/useDailyPlan';
import Text from '@/components/ui/Text';
import { createBrainDump } from '@/lib/api/brain-dumps';
import { uploadAudioBrainDump } from '@/lib/api/daily-plan';
import { Audio } from 'expo-av';

// ── Variant rotation for task cards ─────────────────────────────
const CARD_VARIANTS = ['dark', 'sage', 'ember', 'flax'] as const;

export default function Home() {
  // ── Text brain-dump state ────────────────────────────────────
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Audio recording state ────────────────────────────────────
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // ── Refs & data hooks ────────────────────────────────────────
  const blurTargetRef = useRef<View | null>(null);
  const { data: profile } = useProfile();
  const { data: dailyPlan, isLoading: isPlanLoading, mutate } = useDailyPlan();

  // ── Text brain-dump handler ──────────────────────────────────
  const handleBrainDump = useCallback(async () => {
    if (!query.trim()) return;

    setIsSubmitting(true);
    try {
      await createBrainDump(query);
      setQuery('');
      mutate(); // Refresh daily plan after submission
    } catch (error) {
      console.error('Brain dump error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [query, mutate]);

  // ── Audio recording handlers ─────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Recording] Microphone permission denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      console.error('[Recording] Failed to start:', err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        await uploadAudioBrainDump(uri);
        mutate(); // Refresh daily plan after voice upload
      }
    } catch (err) {
      console.error('[Recording] Failed to stop:', err);
      setRecording(null);
    }
  }, [recording, mutate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([mutate()]);
    } catch (error) {
      console.error('[Home] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  return (
    <Container className="bg-core-background px-4">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="mt-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-x-3">
          <Avatar uri="https://picsum.photos/id/237/200/300" />
          <View>
            <Text className="font-text text-sm text-core-text-secondary">Welcome back,</Text>
            <Text className="font-heading text-xl text-core-text-primary">
              {profile?.name || 'Explorer'}
            </Text>
          </View>
        </View>
        <View className="h-12 w-12 items-center justify-center rounded-full bg-core-surface shadow-sm">
          <Ionicons name="notifications-outline" size={22} color="#1A1714" />
        </View>
      </View>

      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <ScrollView
          className="mt-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E8612A" />}
        >
          {/* Section header */}
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="font-heading text-2xl text-core-text-primary">Your focus</Text>
            <Pressable>
              <Text className="font-text text-sm font-medium text-brand-flax">View all</Text>
            </Pressable>
          </View>

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
              <View className="flex-row justify-between">
                <View className="flex-1 space-y-2">
                  <View className="h-6 w-3/4 rounded bg-core-text-disabled/20" />
                  <View className="h-4 w-1/2 rounded bg-core-text-disabled/20" />
                </View>
                <ActivityIndicator color="#C9A84C" />
              </View>
              <View className="mt-8 h-10 w-full rounded-full bg-core-text-disabled/10" />
            </View>
          )}

          {/* Task cards from Daily Plan */}
          {dailyPlan?.tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              title={task.title}
              reviewCount={Math.max(1, 8 - index * 2)}
              timeRange="10.00 AM - 05.30 PM"
              priority="high"
              variant={CARD_VARIANTS[index % CARD_VARIANTS.length]}
            />
          ))}

          {/* Empty state */}
          {!dailyPlan && !isPlanLoading && (
            <View className="mt-8 items-center px-8">
              <Ionicons name="leaf-outline" size={48} color="#B0AAA3" />
              <Text className="mt-4 text-center font-text text-base text-core-text-secondary">
                No tasks yet. Do a brain dump to get started!
              </Text>
            </View>
          )}
        </ScrollView>
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
    </Container>
  );
}