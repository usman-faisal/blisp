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
  placeholder?: string;
  blurTarget: RefObject<View | null>;
}

export const FloatingInput = ({
  value,
  onChangeText,
  onMicPressIn,
  onMicPressOut,
  onSubmit,
  isRecording = false,
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
          <Ionicons name="infinite-outline" size={22} color="#C9A84C" />
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={isRecording ? 'Listening...' : placeholder}
            placeholderTextColor={isRecording ? '#E8612A' : '#B0AAA3'}
            style={[
              styles.input,
              isRecording && styles.inputRecording,
            ]}
            autoFocus
            onSubmitEditing={onSubmit}
            returnKeyType="send"
          />

          {/* Mic button with glow + pulse */}
          <Pressable onPress={onMicPressIn} onPressOut={onMicPressOut}>
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
  inputRecording: {
    color: '#E8612A', // brand.ember — subtle visual cue
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