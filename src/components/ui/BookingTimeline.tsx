import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Typography, Spacing } from "@/src/features/shared/theme";

const STEPS = ["Requested", "Approved", "Arrived", "Charging", "Completed"] as const;

interface BookingTimelineProps {
  /** The booking status: requested, approved, declined, active, completed, cancelled */
  status: string;
  /** The arrival signal: en_route, arrived, charging, departed */
  currentStep?: string;
}

function resolveStepIndex(status: string, arrivalSignal?: string): number {
  const s = status.toLowerCase();

  if (s === "cancelled" || s === "declined") return -1;
  if (s === "completed") return 4;
  if (s === "active") {
    const signal = (arrivalSignal || "").toLowerCase();
    if (signal === "charging" || signal === "departed") return 3;
    if (signal === "arrived") return 2;
    return 2;
  }
  if (s === "approved") {
    const signal = (arrivalSignal || "").toLowerCase();
    if (signal === "arrived") return 2;
    return 1;
  }
  if (s === "requested") return 0;

  // Fallback: try matching arrival signal directly for backward compat
  const fallback = (arrivalSignal || status).toLowerCase().replace("_", " ").replace("in progress", "charging");
  return STEPS.findIndex((step) => step.toLowerCase() === fallback);
}

export function BookingTimeline({ status, currentStep }: BookingTimelineProps) {
  const isCancelled = status === "cancelled" || status === "declined";
  const currentIndex = resolveStepIndex(status, currentStep);

  if (isCancelled) {
    return (
      <View style={styles.container}>
        <View style={styles.cancelledRow}>
          <View style={[styles.dot, styles.dotCancelled]} />
          <Text style={styles.labelCancelled}>
            {status === "declined" ? "Declined" : "Cancelled"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isActive = index === currentIndex;
        return (
          <View key={step} style={styles.stepRow}>
            <View style={styles.dotColumn}>
              <View
                style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isActive && styles.dotActive,
                ]}
              />
              {index < STEPS.length - 1 && (
                <View style={[styles.line, isCompleted && styles.lineCompleted]} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                isCompleted && styles.labelCompleted,
                isActive && styles.labelActive,
              ]}
            >
              {step}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dotColumn: {
    alignItems: "center",
    width: 24,
    marginRight: Spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.border,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dotCompleted: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotActive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  line: {
    width: 2,
    height: 20,
    backgroundColor: Colors.border,
  },
  lineCompleted: {
    backgroundColor: Colors.primary,
  },
  label: {
    ...Typography.caption,
    paddingTop: 0,
    lineHeight: 16,
  },
  labelCompleted: {
    color: Colors.textPrimary,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: "600",
  },
  cancelledRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dotCancelled: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  labelCancelled: {
    ...Typography.caption,
    color: Colors.error,
    fontWeight: "600",
  },
});
