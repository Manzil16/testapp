import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { PrimaryCTA } from "./PrimaryCTA";

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
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <PrimaryCTA
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
    padding: Spacing.xxxl,
    alignItems: "center",
    marginVertical: Spacing.xl,
    ...Shadows.card,
  },
  icon: {
    fontSize: 48,
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
    paddingHorizontal: Spacing.xxxl,
    alignSelf: "stretch",
  },
});
