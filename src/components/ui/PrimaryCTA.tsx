import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

interface PrimaryCTAProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Use "danger" for destructive actions */
  variant?: "default" | "danger";
}

export function PrimaryCTA({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  variant = "default",
}: PrimaryCTAProps) {
  const isDisabled = disabled || loading;
  const bgColor =
    variant === "danger"
      ? Colors.error
      : isDisabled
      ? Colors.border
      : Colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
      style={[
        styles.button,
        { backgroundColor: bgColor },
        !isDisabled && variant === "default" && Shadows.button,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.textInverse} />
      ) : (
        <Text style={[styles.label, isDisabled && styles.labelDisabled]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  label: {
    ...Typography.cardTitle,
    color: Colors.textInverse,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  labelDisabled: {
    color: Colors.textMuted,
  },
});
