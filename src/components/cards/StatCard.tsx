import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  "🚗": "car-sport",
  "⚡": "flash",
  "📅": "calendar",
  "💰": "cash",
  "📊": "bar-chart",
  "👥": "people",
  "⭐": "star",
  "🔋": "battery-half",
  "🏠": "home",
  "📍": "location",
  "🕐": "time",
  "✅": "checkmark-circle",
  "❌": "close-circle",
  "⚠️": "alert-circle",
};

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  trend?: string;
  trendPositive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
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
  const ioniconsName = ICON_MAP[icon] || "ellipse";

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, style]}
    >
      <View style={[styles.iconWrapper, { backgroundColor: accentColor }]}>
        <Ionicons name={ioniconsName} size={20} color={Colors.primaryDark} />
      </View>
      <Text style={styles.value}>{String(value)}</Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
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
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.cardPadding,
    alignItems: "flex-start",
    ...Shadows.card,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  value: {
    ...Typography.sectionTitle,
    fontSize: 24,
    marginBottom: 2,
  },
  label: {
    ...Typography.caption,
    fontWeight: "500" as const,
    color: Colors.textMuted,
  },
  trend: {
    ...Typography.caption,
    fontWeight: "600" as const,
    marginTop: 4,
  },
});
