import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Typography, Spacing, Radius, Shadows } from "@/src/features/shared/theme";
import { PrimaryCTA } from "../ui/PrimaryCTA";
import { InfoPill } from "../ui/InfoPill";

interface ActiveBookingHeroProps {
  chargerName: string;
  status: string;
  timeLabel: string;
  onNavigate?: () => void;
}

export function ActiveBookingHero({ chargerName, status, timeLabel, onNavigate }: ActiveBookingHeroProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="flash" size={24} color={Colors.textInverse} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>{chargerName}</Text>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
        <InfoPill label={status.replace("_", " ")} variant="primary" />
      </View>
      {onNavigate && (
        <PrimaryCTA label="Navigate" onPress={onNavigate} style={styles.cta} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
  },
  title: {
    ...Typography.cardTitle,
  },
  time: {
    ...Typography.caption,
    marginTop: 2,
  },
  cta: {
    marginTop: Spacing.md,
  },
});
