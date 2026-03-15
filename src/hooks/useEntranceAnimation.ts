import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * Returns an animated style that fades in and slides up 8px on mount.
 * Duration: 280ms, easing: ease-out.
 *
 * Usage:
 *   const entranceStyle = useEntranceAnimation();
 *   <Animated.View style={[styles.root, entranceStyle]}>...</Animated.View>
 */
export function useEntranceAnimation() {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
    translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.ease) });
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}
