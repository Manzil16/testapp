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

  const gradientColors =
    variant === "danger"
      ? (Colors.gradientDanger as unknown as [string, string])
      : isDisabled
      ? [Colors.border, Colors.border] as [string, string]
      : (Colors.gradientAccent as unknown as [string, string]);

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      style={[isDisabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.button,
          !isDisabled && variant === "default" && Shadows.button,
        ]}
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
