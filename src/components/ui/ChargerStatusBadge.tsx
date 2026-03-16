import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Typography, Radius, Spacing } from "@/src/features/shared/theme";

type ChargerStatusType = "approved" | "pending" | "rejected" | "online" | "offline";

interface ChargerStatusBadgeProps {
  status: string;
}

const statusConfig: Record<ChargerStatusType, { label: string; bg: string; text: string }> = {
  approved: { label: "Approved", bg: Colors.successLight, text: Colors.success },
  online: { label: "Online", bg: Colors.successLight, text: Colors.success },
  pending: { label: "Pending", bg: Colors.warningLight, text: Colors.warning },
  rejected: { label: "Rejected", bg: Colors.errorLight, text: Colors.error },
  offline: { label: "Offline", bg: Colors.surfaceAlt, text: Colors.textMuted },
};

export function ChargerStatusBadge({ status }: ChargerStatusBadgeProps) {
  const config = statusConfig[status as ChargerStatusType] || statusConfig.offline;
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
