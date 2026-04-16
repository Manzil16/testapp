import { StyleSheet, Text, TextInput, View } from "react-native";
import { Colors, Radius, Spacing, Typography } from "@/src/features/shared/theme";

interface DistanceInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function DistanceInput({ value, onChange }: DistanceInputProps) {
  function handleChangeText(text: string) {
    const parsed = parseInt(text, 10);
    if (isNaN(parsed)) {
      onChange(0);
      return;
    }
    onChange(Math.min(1000, Math.max(0, parsed)));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Destination Distance</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value === 0 ? "" : String(value)}
          onChangeText={handleChangeText}
          keyboardType="number-pad"
          placeholder="e.g. 120"
          placeholderTextColor={Colors.textMuted}
          maxLength={4}
          returnKeyType="done"
          accessibilityLabel="Distance to destination in kilometres"
        />
        <View style={styles.unitBadge}>
          <Text style={styles.unitText}>km</Text>
        </View>
      </View>
      {value > 1000 && (
        <Text style={styles.hint}>Maximum distance is 1 000 km</Text>
      )}
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  input: {
    ...Typography.cardTitle,
    flex: 1,
    fontSize: 18,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  unitBadge: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  unitText: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  hint: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
});
