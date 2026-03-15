import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

type ToastTone = "success" | "error" | "info";

interface ToastProps {
  visible: boolean;
  message: string;
  title?: string;
  tone?: ToastTone;
  durationMs?: number;
  onDismiss?: () => void;
}

const toneMap: Record<ToastTone, { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: Colors.successLight, border: Colors.success, icon: "checkmark-circle" },
  error: { bg: Colors.errorLight, border: Colors.error, icon: "warning" },
  info: { bg: Colors.infoLight, border: Colors.info, icon: "information-circle" },
};

export function Toast({
  visible,
  message,
  title,
  tone = "info",
  durationMs = 2600,
  onDismiss,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-18);
  const palette = useMemo(() => toneMap[tone], [tone]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      opacity.value = withTiming(1, { duration: 160 });
      translateY.value = withTiming(0, { duration: 160 });

      const timer = setTimeout(() => {
        onDismiss?.();
      }, durationMs);

      return () => clearTimeout(timer);
    }

    if (rendered) {
      opacity.value = withTiming(0, { duration: 140 });
      translateY.value = withTiming(-12, { duration: 140 }, (finished) => {
        if (finished) {
          runOnJS(setRendered)(false);
        }
      });
    }
  }, [durationMs, onDismiss, opacity, rendered, translateY, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!rendered) {
    return null;
  }

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + Spacing.md }, animatedStyle]}>
      <Pressable
        style={[styles.toast, { backgroundColor: palette.bg, borderColor: palette.border }]}
        onPress={onDismiss}
      >
        <Ionicons name={palette.icon} size={18} color={palette.border} />
        <View style={styles.textCol}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={styles.message}>{message}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: Spacing.screenPadding,
    right: Spacing.screenPadding,
    zIndex: 100,
  },
  toast: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadows.card,
  },
  textCol: {
    flex: 1,
  },
  title: {
    ...Typography.cardTitle,
    marginBottom: 1,
  },
  message: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
});
