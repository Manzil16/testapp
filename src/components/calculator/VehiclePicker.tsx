import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

export interface Vehicle {
  id: string;
  name: string;
  range: number;
}

interface VehiclePickerProps {
  vehicles: Vehicle[];
  selected: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
}

export function VehiclePicker({ vehicles, selected, onSelect }: VehiclePickerProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(vehicle: Vehicle) {
    onSelect(vehicle);
    setOpen(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Your Vehicle</Text>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Selected vehicle: ${selected.name}. Tap to change.`}
      >
        <View style={styles.triggerContent}>
          <View style={styles.triggerText}>
            <Text style={styles.vehicleName} numberOfLines={1}>{selected.name}</Text>
            <Text style={styles.vehicleRange}>WLTP range: {selected.range} km</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Vehicle</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {vehicles.map((v) => {
                const isSelected = v.id === selected.id;
                return (
                  <Pressable
                    key={v.id}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => handleSelect(v)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                        {v.name}
                      </Text>
                      <Text style={styles.optionRange}>{v.range} km</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
  trigger: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadows.subtle,
  },
  triggerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  triggerText: {
    flex: 1,
    gap: 2,
  },
  vehicleName: {
    ...Typography.cardTitle,
  },
  vehicleRange: {
    ...Typography.caption,
  },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    maxHeight: "70%",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    ...Shadows.modal,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  sheetTitle: {
    ...Typography.sectionTitle,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    marginVertical: 2,
  },
  optionSelected: {
    backgroundColor: Colors.accentLight,
  },
  optionContent: {
    flex: 1,
    gap: 2,
  },
  optionName: {
    ...Typography.cardTitle,
    fontWeight: "500",
  },
  optionNameSelected: {
    color: Colors.accent,
  },
  optionRange: {
    ...Typography.caption,
  },
});
