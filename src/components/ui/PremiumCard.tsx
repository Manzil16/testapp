import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Radius, Shadows } from "@/src/features/shared/theme";

interface PremiumCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  glowColor?: string;
  noPadding?: boolean;
}

export function PremiumCard({ children, style, glowColor, noPadding }: PremiumCardProps) {
  return (
    <View
      style={[
        styles.outer,
        glowColor ? { shadowColor: glowColor } : undefined,
        style,
      ]}
    >
      <LinearGradient
        colors={Colors.gradientCard as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, noPadding ? undefined : styles.padding]}
      >
        <View style={styles.borderOverlay} />
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: Radius.card,
    ...Shadows.card,
  },
  gradient: {
    borderRadius: Radius.card,
    overflow: "hidden",
    position: "relative",
  },
  padding: {
    padding: 16,
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
});
