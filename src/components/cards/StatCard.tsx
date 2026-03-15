import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  /** Optional small change indicator e.g. "+12% this week" */
  trend?: string;
  trendPositive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  /** Accent color for the icon background */
  accentColor?: string;
}

export function StatCard({
  icon,
  value,
  label,
  trend,
  trendPositive,
  onPress,
  style,
  accentColor = Colors.primaryLight,
}: StatCardProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, style]}
    >
      {/* Icon circle */}
      <View style={[styles.iconWrapper, { backgroundColor: accentColor }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      {/* Value */}
      <Text style={styles.value}>{String(value)}</Text>

      {/* Label */}
      <Text style={styles.label} numberOfLines={1}>{label}</Text>

      {/* Trend */}
      {trend ? (
        <Text
          style={[
            styles.trend,
            { color: trendPositive ? Colors.success : Colors.error },
          ]}
          numberOfLines={1}
        >
          {trend}
        </Text>
      ) : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    alignItems: "flex-start",
    ...Shadows.card,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  icon: {
    fontSize: 20,
  },
  value: {
    ...Typography.priceHighlight,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  trend: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
