import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { RefObject } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

interface FloatingInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onMicPress?: () => void;
  placeholder?: string;
  blurTarget: RefObject<View | null>;
}

export const FloatingInput = ({
  value,
  onChangeText,
  onMicPress,
  placeholder = 'Search...',
  blurTarget,
}: FloatingInputProps) => {
  return (
    <View style={styles.wrapper}>
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
            placeholder={placeholder}
            placeholderTextColor="#B0AAA3" 
            style={styles.input}
            autoFocus
          />
          <Pressable onPress={onMicPress}>
            <Ionicons name="mic-outline" size={22} color="#6B6560" />
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 56,
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
});