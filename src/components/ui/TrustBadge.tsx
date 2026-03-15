import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors, Radius, Typography } from "@/src/features/shared/theme";

export type TrustBadgeType = "verified" | "community" | "top_rated" | "new";

const badgeConfig: Record<TrustBadgeType, { label: string; bg: string; text: string; emoji: string }> = {
  verified: { label: "Verified", bg: Colors.primaryLight, text: Colors.primaryDark, emoji: "✓" },
  community: { label: "Community Host", bg: Colors.infoLight, text: Colors.info, emoji: "◆" },
  top_rated: { label: "Top Rated", bg: Colors.topRatedLight, text: Colors.warning, emoji: "★" },
  new: { label: "New", bg: Colors.surfaceAlt, text: Colors.textSecondary, emoji: "◉" },
};

interface TrustBadgeProps {
  type: TrustBadgeType;
  style?: ViewStyle;
}

export function TrustBadge({ type, style }: TrustBadgeProps) {
  const config = badgeConfig[type];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, style]}>
      <Text style={[styles.emoji, { color: config.text }]}>{config.emoji}</Text>
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: "flex-start",
    gap: 4,
  },
  emoji: {
    ...Typography.badge,
  },
  label: {
    ...Typography.badge,
    letterSpacing: 0.1,
  },
});
