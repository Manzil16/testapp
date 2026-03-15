import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors, Radius } from "@/src/features/shared/theme";

export type InfoPillVariant = "default" | "success" | "warning" | "error" | "info" | "primary";

const variantMap: Record<InfoPillVariant, { bg: string; text: string; border: string }> = {
  default: { bg: Colors.surfaceAlt, text: Colors.textSecondary, border: Colors.border },
  primary: { bg: Colors.primaryLight, text: Colors.primaryDark, border: Colors.primaryLight },
  success: { bg: Colors.successLight, text: Colors.success, border: Colors.successLight },
  warning: { bg: Colors.warningLight, text: Colors.warning, border: Colors.warningLight },
  error: { bg: Colors.errorLight, text: Colors.error, border: Colors.errorLight },
  info: { bg: Colors.infoLight, text: Colors.info, border: Colors.infoLight },
};

interface InfoPillProps {
  label: string;
  variant?: InfoPillVariant;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function InfoPill({ label, variant = "default", icon, style }: InfoPillProps) {
  const palette = variantMap[variant];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: palette.bg, borderColor: palette.border },
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
