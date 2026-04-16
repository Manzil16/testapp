import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RangeStatus } from "@/src/utils/rangeCalculations";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

interface ResultCardProps {
  status: RangeStatus;
  currentRange: number;
  distance: number;
  rangeAfterTrip: number;
  percentAfterTrip: number;
  onFindChargers: () => void;
}

interface StatusConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  borderColor: string;
  backgroundColor: string;
  headline: string;
  advice: string;
  showCta: boolean;
}

const STATUS_CONFIG: Record<RangeStatus, StatusConfig> = {
  "can-reach": {
    icon: "checkmark-circle",
    iconColor: Colors.success,
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
    headline: "You can make it!",
    advice: "You'll arrive with plenty of charge remaining.",
    showCta: false,
  },
  "low-margin": {
    icon: "flash",
    iconColor: Colors.warning,
    borderColor: Colors.warning,
    backgroundColor: Colors.warningLight,
    headline: "Charge recommended",
    advice:
      "You can technically make it, but charging first is recommended for peace of mind.",
    showCta: true,
  },
  "cannot-reach": {
    icon: "warning",
    iconColor: Colors.error,
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
    headline: "Charging required",
    advice:
      "You need to charge before your trip. Find a charger on the Discover tab.",
    showCta: true,
  },
};

export function ResultCard({
  status,
  currentRange,
  distance,
  rangeAfterTrip,
  percentAfterTrip,
  onFindChargers,
}: ResultCardProps) {
  const cfg = STATUS_CONFIG[status];
  const shortfall = distance - currentRange;

  return (
    <View
      style={[styles.card, { borderColor: cfg.borderColor }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Result: ${cfg.headline}. ${cfg.advice}`}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cfg.backgroundColor }]}>
        <Ionicons name={cfg.icon} size={22} color={cfg.iconColor} />
        <Text style={[styles.headline, { color: cfg.iconColor }]}>{cfg.headline}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsBlock}>
        <StatRow label="Current range" value={`${Math.round(currentRange)} km`} />
        <StatRow label="Distance to destination" value={`${distance} km`} />
        {status === "cannot-reach" ? (
          <StatRow
            label="Shortfall"
            value={`${Math.round(shortfall)} km`}
            valueColor={Colors.error}
          />
        ) : (
          <StatRow
            label="Range after arrival"
            value={`${Math.round(rangeAfterTrip)} km (${Math.round(percentAfterTrip)}%)`}
            valueColor={status === "low-margin" ? Colors.warning : Colors.success}
          />
        )}
      </View>

      {/* Advice row */}
      <View style={styles.adviceRow}>
        <Ionicons
          name={(status === "can-reach" ? "bulb-outline" : "plug-outline") as any}
          size={16}
          color={cfg.iconColor}
        />
        <Text style={styles.adviceText}>{cfg.advice}</Text>
      </View>

      {/* CTA */}
      {cfg.showCta && (
        <Pressable
          style={[styles.ctaButton, { backgroundColor: cfg.borderColor }]}
          onPress={onFindChargers}
          accessibilityRole="button"
          accessibilityLabel="Find nearby chargers"
        >
          <Ionicons name="search" size={16} color={Colors.textInverse} />
          <Text style={styles.ctaText}>Find Nearby Chargers</Text>
        </Pressable>
      )}
    </View>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

function StatRow({ label, value, valueColor }: StatRowProps) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1.5,
    overflow: "hidden",
    ...Shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headline: {
    ...Typography.sectionTitle,
    fontSize: 16,
  },
  statsBlock: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statLabel: {
    ...Typography.body,
  },
  statValue: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
  },
  adviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  adviceText: {
    ...Typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.input,
  },
  ctaText: {
    ...Typography.cardTitle,
    fontWeight: "700" as const,
    color: Colors.textInverse,
  },
});
