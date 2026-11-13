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
import { TranscriptionError, transcribeAudio } from '@/lib/api/transcription';
import {
  TranscriptReviewSheet,
  type TranscriptSheetStatus,
} from '@/components/TranscriptReviewSheet';
import {
  useAudioRecorder,
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { Alert, Linking } from 'react-native';
import type { BrainDumpResponse } from '@repo/types';

/**
 * Below this, the capture was almost certainly an accidental tap rather than
 * speech. Checked before upload so we never pay for a 200 ms recording.
 */
const MIN_RECORDING_SECONDS = 1;

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
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  /** Voice capture review state — steps 6–9 of the capture flow. */
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<TranscriptSheetStatus>('transcribing');
  const [transcript, setTranscript] = useState('');
  const [transcriptDuration, setTranscriptDuration] = useState<number | undefined>();
  const [transcriptError, setTranscriptError] = useState<{
    message: string;
    retryable: boolean;
  } | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  /** Kept so "Try again" can re-upload the same audio without re-recording. */
  const lastRecordingUri = useRef<string | null>(null);
  /** Guards against the mic being released twice (press-out + cancel). */
  const isStoppingRef = useRef(false);
  /**
   * True from the moment a press lands until the mic is released again.
   *
   * A ref rather than the isRecording state because startRecording awaits
   * three times before setting that state, and a closure created during those
   * awaits still sees the old value. Without this, a second press in that
   * window starts a competing attempt which fails on the already-claimed mic —
   * raising "Could not start recording" over a recording that is working fine.
   */
  const isActiveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * Wall-clock start of the current recording. Read instead of the
   * recordingSeconds state because the press-out handler can run with a stale
   * closure, and a 1 s interval counter is too coarse to judge a quick tap.
   */
  const recordingStartedAtRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // A recording left running when the screen unmounts would hold the mic and
  // keep the audio session in recording mode. Clearing the timer alone does
  // not give the mic back, so the session is reset too.
  useEffect(
    () => () => {
      stopTimer();
      if (isActiveRef.current) {
        isActiveRef.current = false;
        void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      }
    },
    [stopTimer],
  );

  /**
   * Settles the microphone permission once, on mount.
   *
   * Without this the very first hold is always lost: the OS prompt appears
   * mid-gesture, the user lifts their finger to tap "Allow", and the press-out
   * lands on a recording that never began. Asking here moves that prompt to a
   * moment when no gesture is in flight. Uses the existing granted state when
   * there is one, so it does not re-prompt on every launch.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { granted, canAskAgain } = await getRecordingPermissionsAsync();
        // Only ask when the system will actually show a prompt. A hard denial
        // is left alone: nagging on every launch is worse than letting the
        // user discover it when they reach for the mic.
        if (cancelled || granted || !canAskAgain) return;
        await requestRecordingPermissionsAsync();
      } catch {
        // Non-fatal: the mic handler asks again and reports it properly there.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  /** Uploads audio and shows the transcript for review. Never auto-submits. */
  const runTranscription = useCallback(async (uri: string) => {
    setSheetStatus('transcribing');
    setTranscriptError(null);
    setSheetVisible(true);

    try {
      const result = await transcribeAudio(uri);
      setTranscript(result.transcript);
      setTranscriptDuration(result.durationSeconds);
      setSheetStatus('ready');
    } catch (error) {
      // TranscriptionError messages are already user-facing; anything else is
      // reduced to a generic line rather than surfacing internals.
      const isKnown = error instanceof TranscriptionError;
      setTranscriptError({
        message: isKnown
          ? error.message
          : 'Something went wrong while transcribing. Please try again.',
        retryable: isKnown ? error.retryable : true,
      });
      setSheetStatus('error');
      if (!isKnown) {
        console.error('[Transcription] Unexpected failure:', error);
      }
    }
  }, []);

  /**
   * Asks for the microphone, explaining the outcome when it is refused.
   *
   * Separate from startRecording because the OS prompt is modal: showing it
   * mid-gesture means the user lifts their finger to answer it, onPressOut
   * fires against a recording that never started, and the first hold is lost.
   * This runs before the gesture instead, so by the time the mic button is
   * held the answer is already known.
   */
  const ensureMicPermission = useCallback(async (): Promise<boolean> => {
    const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
    if (granted) return true;

    // Permanently denied needs Settings; a soft denial can just be retried.
    if (canAskAgain) {
      Alert.alert(
        'Microphone needed',
        'BLISP needs your microphone to capture spoken ideas. Tap the mic again to allow it.',
      );
    } else {
      Alert.alert(
        'Microphone access is off',
        'Enable the microphone for BLISP in Settings to capture ideas by voice. You can still type them in the meantime.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
    }
    return false;
  }, []);

  const startRecording = useCallback(async () => {
    // Ignore a press while one is already starting or running, or while the
    // previous one is still releasing a mic the OS has not handed back yet.
    if (isActiveRef.current || isStoppingRef.current) return;
    isActiveRef.current = true;

    try {
      if (!(await ensureMicPermission())) {
        isActiveRef.current = false;
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      // The recorder keeps its own prepared state, which outlives our refs:
      // stop() does not always return it to unprepared, and preparing twice
      // throws "AudioRecorder has already been prepared". Ask the recorder
      // rather than assuming — a prepared recorder can go straight to record().
      if (!recorder.getStatus().canRecord) {
        await recorder.prepareToRecordAsync();
      }

      recorder.record();

      isStoppingRef.current = false;
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);

      stopTimer();
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error('[Recording] Failed to start:', err);

      // Leave the recorder genuinely reusable, or one failure becomes a run of
      // them. Two separate pieces of state have to be undone: the recorder's
      // own prepared session, and the device audio route this function opened.
      await recorder.stop().catch(() => undefined);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);

      isActiveRef.current = false;
      setIsRecording(false);
      stopTimer();

      Alert.alert('Could not start recording', 'Please try again in a moment.');
    }
  }, [recorder, stopTimer, ensureMicPermission]);

  /** Releases the mic and returns the captured uri, or null if unusable. */
  const releaseRecorder = useCallback(async (): Promise<string | null> => {
    stopTimer();
    // Cleared here rather than in each caller: every path that gives the mic
    // back goes through this function, so the next press is accepted even if
    // stop() throws.
    isActiveRef.current = false;
    setIsRecording(false);

    try {
      await recorder.stop();
    } finally {
      // Must run even if stop() throws, or the device stays in recording mode.
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }

    return recorder.uri ?? null;
  }, [recorder, stopTimer]);

  const stopRecording = useCallback(async () => {
    // isActiveRef, not the isRecording state: a press-out can arrive before
    // the state update from startRecording has rendered, and gating on stale
    // state would drop the release and leave the mic open.
    if (!isActiveRef.current || isStoppingRef.current) return;
    isStoppingRef.current = true;

    const startedAt = recordingStartedAtRef.current;
    const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    recordingStartedAtRef.current = null;

    try {
      const uri = await releaseRecorder();

      if (!uri) {
        Alert.alert('Nothing recorded', 'That recording came back empty. Please try again.');
        return;
      }

      if (elapsed < MIN_RECORDING_SECONDS) {
        Alert.alert(
          'Hold to record',
          'Keep the mic button held down while you speak your idea.',
        );
        return;
      }

      lastRecordingUri.current = uri;
      await runTranscription(uri);
    } catch (err) {
      console.error('[Recording] Failed to stop:', err);
      Alert.alert('Recording failed', 'We could not save that recording. Please try again.');
    } finally {
      isStoppingRef.current = false;
    }
  }, [releaseRecorder, runTranscription]);

  /** Abandons the in-progress recording without transcribing or charging. */
  const cancelRecording = useCallback(async () => {
    if (!isActiveRef.current || isStoppingRef.current) return;
    isStoppingRef.current = true;

    recordingStartedAtRef.current = null;

    try {
      await releaseRecorder();
      lastRecordingUri.current = null;
    } catch (err) {
      console.error('[Recording] Failed to cancel:', err);
    } finally {
      isStoppingRef.current = false;
      setRecordingSeconds(0);
    }
  }, [releaseRecorder]);

  const retryTranscription = useCallback(() => {
    const uri = lastRecordingUri.current;
    if (!uri) {
      setSheetVisible(false);
      return;
    }
    void runTranscription(uri);
  }, [runTranscription]);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setTranscript('');
    setTranscriptDuration(undefined);
    setTranscriptError(null);
    lastRecordingUri.current = null;
  }, []);

  /**
   * Confirmed transcript → existing idea flow.
   *
   * isSubmitting gates the button, so a confirmed transcript creates exactly
   * one brain dump even if the user taps twice.
   */
  const submitTranscript = useCallback(async () => {
    const text = transcript.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const result = await createBrainDump(text);
      const projectTitle =
        (result as BrainDumpResponse)?.data?.projects?.[0]?.title ?? 'Your idea';

      closeSheet();
      setToast({ visible: true, projectTitle });
      mutate();
    } catch (error) {
      console.error('[Transcription] Brain dump submit failed:', error);
      // Stay on the review step with the text intact: the transcript is good,
      // only the submit failed, so the user can simply press Send again.
      Alert.alert(
        'Could not send your idea',
        'Your transcript is still here. Check your connection and press Send again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [transcript, isSubmitting, closeSheet, mutate]);

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
        recordingSeconds={recordingSeconds}
        onCancelRecording={cancelRecording}
        placeholder="Unload your thoughts..."
        blurTarget={blurTargetRef}
      />

      <TranscriptReviewSheet
        visible={sheetVisible}
        status={sheetStatus}
        transcript={transcript}
        onChangeTranscript={setTranscript}
        durationSeconds={transcriptDuration}
        errorMessage={transcriptError?.message}
        canRetry={transcriptError?.retryable ?? false}
        isSubmitting={isSubmitting}
        onRetry={retryTranscription}
        onDiscard={closeSheet}
        onSubmit={submitTranscript}
      />

      <SubmissionToast
        visible={toast.visible}
        projectTitle={toast.projectTitle}
        onDismiss={dismissToast}
      />
    </Container>
  );
}