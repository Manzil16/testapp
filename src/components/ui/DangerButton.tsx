import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { PressableScale } from "./PressableScale";

interface DangerButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function DangerButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
}: DangerButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={[isDisabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={isDisabled ? [Colors.border, Colors.border] : (Colors.gradientDanger as unknown as [string, string])}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.button, !isDisabled && Shadows.button]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.textInverse} />
        ) : (
          <Text style={[styles.label, isDisabled && styles.labelDisabled]}>{label}</Text>
        )}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    minWidth: 48,
  },
  disabled: {
    opacity: 0.7,
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
