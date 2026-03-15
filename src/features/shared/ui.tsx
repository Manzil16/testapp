import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Colors, Radius, Spacing, Typography } from "@/src/features/shared/theme";

export type BannerTone = "success" | "warning" | "error" | "info";

const toneStyles: Record<BannerTone, { backgroundColor: string; textColor: string }> = {
  success: { backgroundColor: Colors.successLight, textColor: Colors.success },
  warning: { backgroundColor: Colors.warningLight, textColor: Colors.warning },
  error: { backgroundColor: Colors.errorLight, textColor: Colors.error },
  info: { backgroundColor: Colors.infoLight, textColor: Colors.info },
};

export function StatusBanner({ tone, text }: { tone: BannerTone; text: string }) {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.banner, { backgroundColor: palette.backgroundColor }]}> 
      <Text style={[styles.bannerText, { color: palette.textColor }]}>{text}</Text>
    </View>
  );
}

export function LoadingPanel({ label = "Loading..." }: { label?: string }) {
  return (
    <View style={styles.centerPanel}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.centerText}>{label}</Text>
    </View>
  );
}

export function EmptyPanel({ label }: { label: string }) {
  return (
    <View style={styles.centerPanel}>
      <Text style={styles.centerText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bannerText: {
    ...Typography.label,
    color: Colors.textPrimary,
  },
  centerPanel: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl,
  },
  centerText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
});
