import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Spacing } from "@/src/features/shared/theme";
import { useThemeColors } from "@/src/hooks/useThemeColors";

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Enable vertical scrolling (default: true) */
  scrollable?: boolean;
  /** Background color override */
  backgroundColor?: string;
  /** Disable horizontal padding */
  noPadding?: boolean;
  /** Style override for the inner content wrapper */
  contentStyle?: ViewStyle;
  /** Extra bottom padding — useful when StickyActionBar is present */
  bottomInset?: number;
}

export function ScreenContainer({
  children,
  scrollable = true,
  backgroundColor,
  noPadding = false,
  contentStyle,
  bottomInset = 0,
}: ScreenContainerProps) {
  const themeColors = useThemeColors();
  const bg = backgroundColor ?? themeColors.background;
  const inner = scrollable ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.scrollContent,
        noPadding && styles.noPadding,
        { paddingBottom: 24 + bottomInset },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.fixedContent,
        noPadding && styles.noPadding,
        { paddingBottom: bottomInset },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={["top"]}>
      {scrollable ? (
        inner
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
  },
  fixedContent: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
  },
  noPadding: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
});
