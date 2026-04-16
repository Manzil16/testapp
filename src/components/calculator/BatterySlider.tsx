import { StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

interface BatterySliderProps {
  value: number;
  onChange: (value: number) => void;
}

function getBatteryColor(percent: number): string {
  if (percent <= 20) return Colors.error;
  if (percent <= 50) return Colors.warning;
  return Colors.accent;
}

export function BatterySlider({ value, onChange }: BatterySliderProps) {
  const batteryColor = getBatteryColor(value);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Current Battery</Text>
      <View style={styles.card}>
        <Text style={[styles.percentText, { color: batteryColor }]}>{Math.round(value)}%</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={value}
          onValueChange={onChange}
          minimumTrackTintColor={batteryColor}
          maximumTrackTintColor={Colors.border}
          thumbTintColor={batteryColor}
          accessibilityLabel="Current battery percentage"
          accessibilityValue={{ min: 0, max: 100, now: value }}
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderEndLabel}>0%</Text>
          <Text style={styles.sliderEndLabel}>100%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  percentText: {
    ...Typography.heroNumber,
    fontSize: 48,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  sliderEndLabel: {
    ...Typography.caption,
  },
});
