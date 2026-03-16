import { ActivityIndicator, StyleSheet, Text, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Radius, Shadows, Spacing } from "@/src/features/shared/theme";
import { PressableScale } from "./PressableScale";

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  colors?: readonly string[];
  compact?: boolean;
}

export function GradientButton({
  label,
  onPress,
  loading,
  disabled,
  style,
  colors,
  compact,
}: GradientButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={(colors ?? Colors.gradientAccent) as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, compact && styles.compact]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.textInverse} size="small" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.button,
  },
  compact: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textInverse,
    letterSpacing: 0.3,
    fontFamily: "DMSans_700Bold",
  },
  disabled: {
    opacity: 0.5,
  },
});
