import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { SecondaryButton } from "./SecondaryButton";

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  "⚡": "flash",
  "🗺️": "map",
  "🔍": "search",
  "⭐": "star",
  "⚠️": "alert-circle",
  "📅": "calendar",
  "🧾": "receipt",
  "🔋": "battery-half",
  "📦": "cube",
  "👤": "person",
  "🏠": "home",
  "🛡️": "shield-checkmark",
  "🔔": "notifications",
  "📊": "bar-chart",
  "✅": "checkmark-circle",
};

interface EmptyStateCardProps {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyStateCard({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  style,
}: EmptyStateCardProps) {
  const ioniconsName = ICON_MAP[icon] || "ellipse";

  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name={ioniconsName} size={28} color={Colors.primaryDark} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <SecondaryButton
          label={actionLabel}
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.xxxl,
    alignItems: "center",
    marginVertical: Spacing.xl,
    ...Shadows.card,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.cardTitle,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 20,
  },
  action: {
    marginTop: Spacing.xl,
    alignSelf: "stretch",
  },
});
