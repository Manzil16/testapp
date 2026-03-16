import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface BadgeWrapperProps {
  count: number;
  children: ReactNode;
}

export function BadgeWrapper({ count, children }: BadgeWrapperProps) {
  const showBadge = Number.isFinite(count) && count > 0;
  const scale = useRef(new Animated.Value(0)).current;
  const prevCount = useRef(0);

  useEffect(() => {
    if (showBadge && prevCount.current === 0) {
      // Spring animation when count goes 0→positive
      scale.setValue(0);
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else if (showBadge) {
      scale.setValue(1);
    } else {
      Animated.timing(scale, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
    prevCount.current = showBadge ? count : 0;
  }, [count, scale, showBadge]);

  const label = count > 9 ? "9+" : String(count);

  if (!showBadge) {
    return <>{children}</>;
  }

  return (
    <View style={styles.wrapper}>
      {children}
      <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
        <Text style={styles.badgeText}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF4757",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 13,
  },
});
