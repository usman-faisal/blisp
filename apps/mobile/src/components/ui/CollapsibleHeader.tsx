import { Animated, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  // On iOS the app window extends behind the status bar, so we must offset by
  // the safe-area top inset. On Android the window already starts below the
  // status bar, so a fixed 8px gap is sufficient.
  const topOffset = Platform.OS === 'ios' ? insets.top : 8;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: topOffset,
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
