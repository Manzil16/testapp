import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { Colors, Radius, Spacing } from "@/src/features/shared/theme";

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** "outlined" = border + transparent bg. "ghost" = no border, no bg. */
  variant?: "outlined" | "ghost";
  /** Icon to render before label */
  icon?: React.ReactNode;
}

export function SecondaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  variant = "outlined",
  icon,
}: SecondaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.button,
        variant === "outlined" && styles.outlined,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <>
          {icon ? icon : null}
          <Text
            style={[
              styles.label,
              variant === "ghost" && styles.ghostLabel,
              isDisabled && styles.labelDisabled,
              icon ? { marginLeft: 6 } : undefined,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  ghostLabel: {
    color: Colors.textSecondary,
  },
  labelDisabled: {
    color: Colors.textMuted,
  },
});
