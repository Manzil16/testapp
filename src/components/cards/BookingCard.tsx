import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Colors, Radius, Shadows, Spacing } from "@/src/features/shared/theme";
import { InfoPill, InfoPillVariant } from "../ui/InfoPill";

export type BookingStatus =
  | "requested"
  | "approved"
  | "declined"
  | "active"
  | "completed"
  | "cancelled"
  | "expired"
  | "missed";

const statusConfig: Record<BookingStatus, { label: string; variant: InfoPillVariant; borderColor: string }> = {
  requested: { label: "Pending Approval", variant: "warning", borderColor: "#F59E0B" },
  approved: { label: "Confirmed", variant: "success", borderColor: "#00BFA5" },
  declined: { label: "Declined", variant: "error", borderColor: "#EF4444" },
  active: { label: "Charging", variant: "primary", borderColor: "#3B82F6" },
  completed: { label: "Completed", variant: "success", borderColor: "#10B981" },
  cancelled: { label: "Cancelled", variant: "error", borderColor: "#94A3B8" },
  expired: { label: "Expired", variant: "error", borderColor: "#94A3B8" },
  missed: { label: "Missed", variant: "error", borderColor: "#EF4444" },
};

export interface BookingCardData {
  id: string;
  chargerName: string;
  chargerAddress: string;
  status: BookingStatus;
  /** ISO date string */
  scheduledAt: string;
  durationMinutes?: number;
  kwhDelivered?: number;
  totalCost?: number;
}

interface BookingCardProps {
  booking: BookingCardData;
  /** Primary action label (e.g. "View Details", "Approve") */
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  /** Secondary action label (e.g. "Cancel") */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  onPress?: () => void;
  style?: ViewStyle;
}

export function BookingCard({
  booking,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  onPress,
  style,
}: BookingCardProps) {
  const { chargerName, chargerAddress, status, scheduledAt, durationMinutes, kwhDelivered, totalCost } =
    booking;
  const { label, variant, borderColor: statusBorderColor } = statusConfig[status];

  const formattedDate = new Date(scheduledAt).toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = new Date(scheduledAt).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      style={[styles.card, { borderLeftColor: statusBorderColor }, style]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.chargerName} numberOfLines={1}>{chargerName}</Text>
          <Text style={styles.address} numberOfLines={1}>{chargerAddress}</Text>
        </View>
        <InfoPill label={label} variant={variant} />
      </View>

      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{formattedDate}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Time</Text>
          <Text style={styles.metaValue}>{formattedTime}</Text>
        </View>
        {durationMinutes !== undefined && (
          <>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Duration</Text>
              <Text style={styles.metaValue}>{durationMinutes}min</Text>
            </View>
          </>
        )}
        {kwhDelivered !== undefined && (
          <>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Energy</Text>
              <Text style={styles.metaValue}>{kwhDelivered.toFixed(1)}kWh</Text>
            </View>
          </>
        )}
        {totalCost !== undefined && (
          <>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Cost</Text>
              <Text style={[styles.metaValue, styles.costValue]}>${totalCost.toFixed(2)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Action buttons */}
      {(primaryActionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {secondaryActionLabel && onSecondaryAction && (
            <TouchableOpacity onPress={onSecondaryAction} style={[styles.actionBtn, styles.secondaryBtn]}>
              <Text style={styles.secondaryBtnText}>{secondaryActionLabel}</Text>
            </TouchableOpacity>
          )}
          {primaryActionLabel && onPrimaryAction && (
            <TouchableOpacity onPress={onPrimaryAction} style={[styles.actionBtn, styles.primaryBtn]}>
              <Text style={styles.primaryBtnText}>{primaryActionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.border,
    ...Shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  chargerName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  address: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  metaItem: {
    flex: 1,
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.textMuted,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  costValue: {
    color: Colors.primary,
  },
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
  },
  secondaryBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textInverse,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});
