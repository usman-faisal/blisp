import { useRef, useMemo, useState, useEffect } from 'react';
import { Animated } from 'react-native';

export function useCollapsibleHeader(height: number = 80) {
  const scrollY = useRef(new Animated.Value(0)).current;

  /**
   * Whether the header has faded out of sight.
   *
   * Tracked as React state rather than read off the Animated.Value, because
   * `pointerEvents` is a prop and cannot be driven by the native animation
   * driver. A faded header stays hit-testable otherwise, so its buttons keep
   * taking touches from where they are no longer visible.
   */
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Matches the opacity interpolation below: fully transparent at height / 2.
    const id = scrollY.addListener(({ value }) => {
      setIsCollapsed(value >= height / 2);
    });

    return () => scrollY.removeListener(id);
  }, [scrollY, height]);

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

  return { scrollY, translateY, opacity, onScroll, headerHeight: height, isCollapsed };
}
