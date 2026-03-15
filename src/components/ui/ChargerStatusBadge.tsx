import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Typography, Radius, Spacing } from "@/src/features/shared/theme";

type ChargerStatusType = "verified" | "pending_verification" | "suspended" | "rejected" | "online" | "offline";

interface ChargerStatusBadgeProps {
  status: ChargerStatusType;
}

const statusConfig: Record<ChargerStatusType, { label: string; bg: string; text: string }> = {
  verified: { label: "Verified", bg: Colors.successLight, text: Colors.success },
  online: { label: "Online", bg: Colors.successLight, text: Colors.success },
  pending_verification: { label: "Pending", bg: Colors.warningLight, text: Colors.warning },
  suspended: { label: "Suspended", bg: Colors.errorLight, text: Colors.error },
  rejected: { label: "Rejected", bg: Colors.errorLight, text: Colors.error },
  offline: { label: "Offline", bg: Colors.surfaceAlt, text: Colors.textMuted },
};

export function ChargerStatusBadge({ status }: ChargerStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.offline;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    alignSelf: "flex-start",
  },
  text: {
    ...Typography.badge,
  },
});
