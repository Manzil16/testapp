import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Typography, Spacing, Radius, Shadows } from "@/src/features/shared/theme";

interface NearbyChargerCardProps {
  name: string;
  suburb: string;
  powerKw: number;
  pricePerKwh: number;
  onPress: () => void;
}

export function NearbyChargerCard({ name, suburb, powerKw, pricePerKwh, onPress }: NearbyChargerCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconBox}>
        <Ionicons name="flash" size={20} color={Colors.primary} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <Text style={styles.meta}>{suburb}</Text>
      <View style={styles.row}>
        <Text style={styles.power}>{powerKw} kW</Text>
        <Text style={styles.price}>${pricePerKwh.toFixed(2)}/kWh</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 160,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginRight: Spacing.md,
    ...Shadows.card,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  name: {
    ...Typography.cardTitle,
    marginBottom: 2,
  },
  meta: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  power: {
    ...Typography.badge,
    color: Colors.textSecondary,
  },
  price: {
    ...Typography.badge,
    color: Colors.primary,
  },
});
