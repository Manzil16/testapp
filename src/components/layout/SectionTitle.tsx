import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Spacing, Typography } from "@/src/features/shared/theme";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  /** Label for the right-side action link */
  actionLabel?: string;
  /** Callback for the right-side action */
  onAction?: () => void;
  /** Extra top margin override */
  topSpacing?: number;
}

export function SectionTitle({
  title,
  subtitle,
  actionLabel,
  onAction,
  topSpacing,
}: SectionTitleProps) {
  return (
    <View style={[styles.container, topSpacing !== undefined && { marginTop: topSpacing }]}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    marginTop: Spacing.xxl,
  },
  left: {
    flex: 1,
    marginRight: Spacing.md,
  },
  title: {
    ...Typography.sectionTitle,
  },
  subtitle: {
    ...Typography.label,
    color: Colors.textMuted,
    marginTop: 2,
  },
  action: {
    ...Typography.label,
    fontWeight: "600" as const,
    color: Colors.primary,
    marginTop: 2,
  },
});
