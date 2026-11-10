import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { RefObject, useEffect, useRef } from 'react';
import { Animated, Easing, Keyboard, KeyboardEvent, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

interface FloatingInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onMicPressIn?: () => void;
  onMicPressOut?: () => void;
  onSubmit?: () => void;
  isRecording?: boolean;
  /** Seconds elapsed in the current recording, shown in place of the icon. */
  recordingSeconds?: number;
  /** Abandons the recording without transcribing it. */
  onCancelRecording?: () => void;
  placeholder?: string;
  blurTarget: RefObject<View | null>;
}

function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export const FloatingInput = ({
  value,
  onChangeText,
  onMicPressIn,
  onMicPressOut,
  onSubmit,
  isRecording = false,
  recordingSeconds = 0,
  onCancelRecording,
  placeholder = 'Search...',
  blurTarget,
}: FloatingInputProps) => {
  // ── Pulsing animation for the mic icon while recording ──
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const bottomAnim = useRef(new Animated.Value(36)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      Animated.timing(bottomAnim, {
        toValue: e.endCoordinates.height + 8,
        duration: Platform.OS === 'ios' ? e.duration : 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e: KeyboardEvent) => {
      Animated.timing(bottomAnim, {
        toValue: 36,
        duration: Platform.OS === 'ios' ? e.duration : 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [bottomAnim]);

  useEffect(() => {
    if (isRecording) {
      // Pulse the mic icon opacity
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // Animate the glow ring in
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);

      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [isRecording, pulseAnim, glowAnim]);

  const glowShadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 10],
  });

  const glowShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  return (
    <Animated.View style={[styles.wrapper, { bottom: bottomAnim }]}>
      <BlurView
        blurTarget={blurTarget}
        intensity={60}
        tint="light"
        blurMethod="dimezisBlurView"
        style={styles.blurView}
      >
        <View style={styles.row}>
          {/* While recording, swap the brand mark for a cancel affordance so the
              user can abandon a recording instead of being forced to send it. */}
          {isRecording && onCancelRecording ? (
            <Pressable
              onPress={onCancelRecording}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cancel recording"
            >
              <Ionicons name="close-circle" size={22} color="#6B6560" />
            </Pressable>
          ) : (
            <Ionicons name="infinite-outline" size={22} color="#C9A84C" />
          )}

          {isRecording ? (
            <View style={styles.recordingRow}>
              <View style={styles.recordingDot} />
              <Animated.Text style={[styles.recordingLabel, { opacity: pulseAnim }]}>
                Listening…
              </Animated.Text>
              <Animated.Text
                style={styles.elapsed}
                accessibilityLabel={`Recording, ${formatElapsed(recordingSeconds)} elapsed`}
              >
                {formatElapsed(recordingSeconds)}
              </Animated.Text>
            </View>
          ) : (
            <TextInput
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#B0AAA3"
              style={styles.input}
              autoFocus
              onSubmitEditing={onSubmit}
              returnKeyType="send"
            />
          )}

          {/* Mic button with glow + pulse */}
          {/* onPressIn, not onPress: press-and-hold means recording must begin
              the moment the finger lands. With onPress (which fires on release)
              React Native emits onPressOut first, so a tap would stop a
              recording that had not started and then leave one running. */}
          <Pressable
            onPressIn={onMicPressIn}
            onPressOut={onMicPressOut}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? 'Release to transcribe' : 'Hold to record your idea'}
          >
            <Animated.View
              style={[
                styles.micContainer,
                isRecording && styles.micContainerActive,
                {
                  shadowRadius: glowShadowRadius,
                  shadowOpacity: glowShadowOpacity,
                },
              ]}
            >
              <Animated.View style={{ opacity: pulseAnim }}>
                <Ionicons
                  name={isRecording ? 'mic' : 'mic-outline'}
                  size={22}
                  color={isRecording ? '#E8612A' : '#6B6560'}
                />
              </Animated.View>
            </Animated.View>
          </Pressable>
        </View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  blurView: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DDD8D0', // semantic.border
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    height: 52,
    backgroundColor: '#EFEAE2', // core.surface (fallback when blur isn't strong)
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'InstrumentSans', // theme fontFamily.text
    color: '#1A1714', // core.text-primary
  },
  recordingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8612A', // brand.ember
  },
  recordingLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'InstrumentSans',
    color: '#E8612A', // brand.ember
  },
  elapsed: {
    fontSize: 14,
    fontFamily: 'InstrumentSans',
    color: '#6B6560', // core.text-secondary
    fontVariant: ['tabular-nums'],
  },
  micContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow base (iOS)
    shadowColor: '#E8612A',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    shadowOpacity: 0,
    // Elevation for Android
    elevation: 0,
  },
  micContainerActive: {
    backgroundColor: 'rgba(232, 97, 42, 0.08)', // brand.ember at 8% — subtle glow bg
    elevation: 6,
  },
});