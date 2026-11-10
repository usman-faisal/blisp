import Text from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';

/** What the sheet is currently doing. Drives which controls are shown. */
export type TranscriptSheetStatus = 'transcribing' | 'ready' | 'error';

interface TranscriptReviewSheetProps {
  visible: boolean;
  status: TranscriptSheetStatus;
  /** Editable transcript. Owned by the parent so a dismiss cannot lose it. */
  transcript: string;
  onChangeTranscript: (text: string) => void;
  /** Seconds of audio captured, shown as context for the transcript. */
  durationSeconds?: number;
  errorMessage?: string;
  /** Only offered when the same audio is worth sending again. */
  canRetry?: boolean;
  isSubmitting?: boolean;
  onRetry: () => void;
  onDiscard: () => void;
  onSubmit: () => void;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Step 7–9 of voice capture: review and edit the transcript, then confirm.
 *
 * The confirm button is the only path into the idea flow, and it disables
 * itself while submitting — a transcription must never create two projects
 * because of a double tap.
 */
export function TranscriptReviewSheet({
  visible,
  status,
  transcript,
  onChangeTranscript,
  durationSeconds,
  errorMessage,
  canRetry = false,
  isSubmitting = false,
  onRetry,
  onDiscard,
  onSubmit,
}: TranscriptReviewSheetProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const [hasEdited, setHasEdited] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 12,
      }).start();
    } else {
      slideAnim.setValue(300);
      setHasEdited(false);
    }
  }, [visible, slideAnim]);

  const trimmed = transcript.trim();
  // Matches the backend DTO's MinLength(2) so we fail here rather than on a
  // round trip the user has to interpret.
  const canSubmit = status === 'ready' && trimmed.length >= 2 && !isSubmitting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android back button should behave like Discard, not strand the sheet.
      onRequestClose={isSubmitting ? undefined : onDiscard}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end bg-black/40">
        {/* Tapping the backdrop discards, except mid-submit. */}
        <Pressable
          className="flex-1"
          accessibilityLabel="Dismiss transcript"
          onPress={isSubmitting ? undefined : onDiscard}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            style={{ transform: [{ translateY: slideAnim }] }}
            className="rounded-t-3xl bg-core-background px-5 pb-10 pt-4"
          >
            {/* Grab handle */}
            <View className="mb-4 items-center">
              <View className="h-1 w-10 rounded-full bg-core-text-disabled/30" />
            </View>

            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-x-2">
                <Ionicons name="mic" size={18} color="#E8612A" />
                <Text className="font-heading text-xl text-core-text-primary">Your idea</Text>
              </View>

              {!isSubmitting && (
                <Pressable
                  onPress={onDiscard}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Discard recording"
                >
                  <Ionicons name="close" size={22} color="#6B6560" />
                </Pressable>
              )}
            </View>

            {status === 'transcribing' && (
              <View className="items-center py-10">
                <ActivityIndicator color="#E8612A" />
                <Text className="mt-3 text-sm text-core-text-secondary">
                  Transcribing your recording…
                </Text>
              </View>
            )}

            {status === 'error' && (
              <View className="py-4">
                <View className="flex-row items-start gap-x-3 rounded-2xl bg-brand-ember-mist px-4 py-3">
                  <Ionicons name="alert-circle-outline" size={20} color="#E8612A" />
                  <Text className="flex-1 text-sm leading-5 text-core-text-secondary">
                    {errorMessage || 'That recording could not be transcribed.'}
                  </Text>
                </View>

                <View className="mt-5 flex-row gap-x-3">
                  <Pressable
                    onPress={onDiscard}
                    className="flex-1 items-center rounded-[28px] border border-semantic-border py-4"
                    accessibilityRole="button"
                  >
                    <Text className="font-text text-base font-semibold text-core-text-secondary">
                      Close
                    </Text>
                  </Pressable>

                  {canRetry && (
                    <Pressable
                      onPress={onRetry}
                      className="flex-1 items-center rounded-[28px] bg-brand-ember py-4"
                      accessibilityRole="button"
                    >
                      <Text className="font-text text-base font-semibold text-white">
                        Try again
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {status === 'ready' && (
              <>
                <TextInput
                  value={transcript}
                  onChangeText={(text) => {
                    setHasEdited(true);
                    onChangeTranscript(text);
                  }}
                  multiline
                  editable={!isSubmitting}
                  textAlignVertical="top"
                  placeholder="Your transcribed idea…"
                  placeholderTextColor="#B0AAA3"
                  accessibilityLabel="Edit transcript before sending"
                  className="min-h-[120px] max-h-[220px] rounded-2xl bg-core-surface px-4 py-3 font-text text-base leading-6 text-core-text-primary"
                />

                <View className="mt-2 flex-row items-center gap-x-1.5">
                  <Ionicons name="create-outline" size={12} color="#B0AAA3" />
                  <Text className="text-xs text-core-text-disabled">
                    {durationSeconds ? `${formatDuration(durationSeconds)} recorded · ` : ''}
                    {hasEdited ? 'edited' : 'edit any mistakes before sending'}
                  </Text>
                </View>

                {trimmed.length > 0 && trimmed.length < 2 && (
                  <Text className="mt-2 text-xs text-brand-ember">
                    Add a little more detail before sending.
                  </Text>
                )}

                <View className="mt-5 flex-row gap-x-3">
                  <Pressable
                    onPress={onDiscard}
                    disabled={isSubmitting}
                    className={`flex-1 items-center rounded-[28px] border border-semantic-border py-4 ${
                      isSubmitting ? 'opacity-40' : ''
                    }`}
                    accessibilityRole="button"
                  >
                    <Text className="font-text text-base font-semibold text-core-text-secondary">
                      Discard
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={onSubmit}
                    disabled={!canSubmit}
                    className={`flex-[1.4] flex-row items-center justify-center gap-x-2 rounded-[28px] bg-brand-ember py-4 ${
                      canSubmit ? '' : 'opacity-40'
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel="Send idea to BLISP"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text className="font-text text-base font-semibold text-white">Send</Text>
                        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
