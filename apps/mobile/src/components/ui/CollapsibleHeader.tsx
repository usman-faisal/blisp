import { Animated, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  translateY: Animated.AnimatedInterpolation<number>;
  opacity: Animated.AnimatedInterpolation<number>;
  height: number;
  /** Extra styles applied to the outer animated container */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * Absolutely-positioned header that collapses upward as the user scrolls.
 * Pair with `useCollapsibleHeader` and pass `headerHeight` as `paddingTop`
 * on the sibling ScrollView's `contentContainerStyle`.
 */
export function CollapsibleHeader({ translateY, opacity, height, style, children }: Props) {
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: 8,
          left: 0,
          right: 0,
          zIndex: 10,
          height,
          transform: [{ translateY }],
          opacity,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
