import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Colors, Radius, Spacing } from "@/src/features/shared/theme";

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function FilterChip({ label, active = false, onPress, icon, style }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        active ? styles.chipActive : styles.chipInactive,
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Convenience: horizontal scrollable row of FilterChips
interface FilterChipRowProps {
  chips: { id: string; label: string; icon?: React.ReactNode }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  style?: ViewStyle;
}

export function FilterChipRow({ chips, activeId, onSelect, style }: FilterChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {chips.map((chip) => (
        <FilterChip
          key={chip.id}
          label={chip.label}
          icon={chip.icon}
          active={activeId === chip.id}
          onPress={() => onSelect(chip.id)}
          style={styles.rowChip}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  icon: {
    marginRight: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  labelActive: {
    color: Colors.textInverse,
  },
  labelInactive: {
    color: Colors.textSecondary,
  },
  row: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  rowChip: {
    // handled by gap in row
  },
});
