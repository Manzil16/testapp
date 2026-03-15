import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors, Radius, Spacing } from "@/src/features/shared/theme";

interface Step {
  id: string;
  label: string;
}

interface ProgressStepperProps {
  steps: Step[];
  /** ID of the current active step */
  activeId: string;
  style?: ViewStyle;
}

export function ProgressStepper({ steps, activeId, style }: ProgressStepperProps) {
  const activeIndex = steps.findIndex((s) => s.id === activeId);

  return (
    <View style={[styles.container, style]}>
      {steps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <React.Fragment key={step.id}>
            <View style={styles.step}>
              {/* Circle */}
              <View
                style={[
                  styles.circle,
                  isDone && styles.circleDone,
                  isActive && styles.circleActive,
                ]}
              >
                <Text
                  style={[
                    styles.circleText,
                    (isDone || isActive) && styles.circleTextActive,
                  ]}
                >
                  {isDone ? "✓" : String(index + 1)}
                </Text>
              </View>
              {/* Label */}
              <Text
                style={[
                  styles.label,
                  isActive && styles.labelActive,
                  isDone && styles.labelDone,
                ]}
              >
                {step.label}
              </Text>
            </View>

            {/* Connector line (not after last step) */}
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.connector,
                  isDone && styles.connectorDone,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  step: {
    alignItems: "center",
    gap: 6,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  circleDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  circleActive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.primary,
  },
  circleText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  circleTextActive: {
    color: Colors.primary,
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.textMuted,
    textAlign: "center",
    maxWidth: 56,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: "600",
  },
  labelDone: {
    color: Colors.textSecondary,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginBottom: 14, // align with circle vertical center
    marginHorizontal: 2,
  },
  connectorDone: {
    backgroundColor: Colors.primary,
  },
});
