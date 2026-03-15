import React from "react";
import { StyleSheet, View } from "react-native";
import { Colors, Spacing } from "@/src/features/shared/theme";

interface SectionDividerProps {
  spacing?: number;
}

export function SectionDivider({ spacing = Spacing.xxl }: SectionDividerProps) {
  return <View style={[styles.divider, { marginVertical: spacing }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
