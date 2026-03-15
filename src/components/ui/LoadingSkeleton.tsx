import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { Colors, Radius } from "@/src/features/shared/theme";

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({
  width = "100%",
  height = 16,
  borderRadius = Radius.md,
  style,
}: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.box,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

// Pre-built skeleton layouts for common patterns

export function ChargerCardSkeleton() {
  return (
    <View style={styles.chargerCard}>
      <SkeletonBox height={160} borderRadius={Radius.lg} style={styles.image} />
      <View style={styles.cardBody}>
        <SkeletonBox width="70%" height={16} />
        <SkeletonBox width="45%" height={12} style={styles.mt8} />
        <View style={styles.row}>
          <SkeletonBox width={60} height={22} borderRadius={Radius.pill} />
          <SkeletonBox width={60} height={22} borderRadius={Radius.pill} style={styles.ml8} />
        </View>
        <SkeletonBox width="30%" height={18} style={styles.mt8} />
      </View>
    </View>
  );
}

export function StatCardSkeleton() {
  return (
    <View style={styles.statCard}>
      <SkeletonBox width={36} height={36} borderRadius={Radius.lg} />
      <SkeletonBox width="60%" height={20} style={styles.mt8} />
      <SkeletonBox width="80%" height={12} style={styles.mt4} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.border,
  },
  chargerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    overflow: "hidden",
    marginBottom: 12,
  },
  image: {
    marginBottom: 0,
    borderRadius: 0,
  },
  cardBody: {
    padding: 16,
    gap: 8,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: 16,
    flex: 1,
  },
  row: {
    flexDirection: "row",
    marginTop: 8,
  },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  ml8: { marginLeft: 8 },
});
