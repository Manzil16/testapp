import React from "react";
import { StyleSheet, Text, ViewStyle } from "react-native";
import { Colors, Spacing, Typography } from "@/src/features/shared/theme";
import { PressableScale } from "./PressableScale";

interface TextButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function TextButton({
  label,
  onPress,
  disabled = false,
  style,
}: TextButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={[styles.button, disabled && styles.disabled, style]}
    >
      <Text style={styles.label}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...Typography.label,
    color: Colors.accent,
    textDecorationLine: "underline",
  },
});
