import { useRef, useMemo } from 'react';
import { Animated } from 'react-native';

export function useCollapsibleHeader(height: number = 80) {
  const scrollY = useRef(new Animated.Value(0)).current;

  const translateY = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, height],
        outputRange: [0, -height],
        extrapolate: 'clamp',
      }),
    [scrollY, height],
  );

  const opacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, height / 2],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [scrollY, height],
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  return { scrollY, translateY, opacity, onScroll, headerHeight: height };
}
