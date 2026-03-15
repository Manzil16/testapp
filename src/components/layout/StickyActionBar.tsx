import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows, Spacing } from "@/src/features/shared/theme";

interface StickyActionBarProps {
  children: React.ReactNode;
}

/**
 * Pins action button(s) to the bottom of the screen above the home indicator.
 * Wrap PrimaryCTA or multiple buttons inside this component on detail screens.
 */
export function StickyActionBar({ children }: StickyActionBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.modal,
  },
});
