import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Colors, Radius, Shadows, Spacing } from "@/src/features/shared/theme";

interface HeroStat {
  label: string;
  value: string;
}

interface HeroSummaryCardProps {
  /** Large headline — vehicle name, trip title, etc. */
  title: string;
  /** Supporting line — subtitle or summary text */
  subtitle?: string;
  /** Emoji or character used as the hero icon */
  icon?: string;
  /** Icon background color */
  iconColor?: string;
  /** Up to 3 key stats rendered in a row */
  stats?: HeroStat[];
  /** Optional right-side action (e.g. "Edit", "Change") */
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function HeroSummaryCard({
  title,
  subtitle,
  icon,
  iconColor = Colors.primaryLight,
  stats,
  actionLabel,
  onAction,
  style,
}: HeroSummaryCardProps) {
  return (
    <View style={[styles.card, style]}>
      {/* Top row: icon + text + action */}
      <View style={styles.topRow}>
        {icon ? (
          <View style={[styles.iconWrapper, { backgroundColor: iconColor }]}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
        ) : null}

        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>

        {actionLabel && onAction ? (
          <TouchableOpacity onPress={onAction} style={styles.actionBtn}>
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Stats row */}
      {stats && stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 && <View style={styles.statDivider} />}
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    ...Shadows.card,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  icon: {
    fontSize: 26,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primaryDark,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
});
