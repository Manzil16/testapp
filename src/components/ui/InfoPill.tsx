import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors, Radius } from "@/src/features/shared/theme";

export type InfoPillVariant = "default" | "success" | "warning" | "error" | "info" | "primary";

const variantMap: Record<InfoPillVariant, { bg: string; text: string; border: string }> = {
  default: { bg: Colors.surfaceAlt, text: Colors.textSecondary, border: Colors.border },
  primary: { bg: Colors.primaryLight, text: "#00897B", border: Colors.primaryLight },
  success: { bg: "#D1FAE5", text: "#059669", border: "#D1FAE5" },
  warning: { bg: "#FEF3C7", text: "#D97706", border: "#FEF3C7" },
  error: { bg: "#FEE2E2", text: "#DC2626", border: "#FEE2E2" },
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
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    fontFamily: "DMSans_700Bold",
    textTransform: "uppercase",
  },
});
