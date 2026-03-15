import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Typography, Spacing, Radius, Shadows } from "@/src/features/shared/theme";

interface EarningsCardProps {
  totalEarnings: number;
  periodLabel: string;
  sessionsCount: number;
  periods?: string[];
  activePeriod?: string;
  onChangePeriod?: (period: string) => void;
}

export function EarningsCard({
  totalEarnings,
  periodLabel,
  sessionsCount,
  periods,
  activePeriod,
  onChangePeriod,
}: EarningsCardProps) {
  const periodItems = periods && periods.length ? periods : [periodLabel];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="wallet" size={20} color={Colors.textInverse} />
        </View>
        <Text style={styles.period}>{activePeriod || periodLabel}</Text>
      </View>
      {periodItems.length > 1 && onChangePeriod ? (
        <View style={styles.periodRow}>
          {periodItems.map((period) => {
            const selected = period === (activePeriod || periodLabel);
            return (
              <TouchableOpacity
                key={period}
                style={[styles.periodChip, selected && styles.periodChipActive]}
                onPress={() => onChangePeriod(period)}
              >
                <Text style={[styles.periodChipLabel, selected && styles.periodChipLabelActive]}>
                  {period}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      <Text style={styles.amount}>${totalEarnings.toFixed(2)}</Text>
      <Text style={styles.sessions}>{sessionsCount} sessions completed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  period: {
    ...Typography.label,
  },
  periodRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  periodChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  periodChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  periodChipLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  periodChipLabelActive: {
    color: Colors.primaryDark,
  },
  amount: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  sessions: {
    ...Typography.caption,
  },
});
