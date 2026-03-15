import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Colors, Radius, Spacing } from "@/src/features/shared/theme";

interface Segment {
  id: string;
  label: string;
  icon?: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  activeId: string;
  onChange: (id: string) => void;
  style?: ViewStyle;
}

export function SegmentedControl({
  segments,
  activeId,
  onChange,
  style,
}: SegmentedControlProps) {
  return (
    <View style={[styles.container, style]}>
      {segments.map((segment) => {
        const isActive = segment.id === activeId;
        return (
          <TouchableOpacity
            key={segment.id}
            onPress={() => onChange(segment.id)}
            activeOpacity={0.8}
            style={[styles.segment, isActive && styles.segmentActive]}
          >
            {segment.icon ? (
              <Text style={[styles.icon, isActive && styles.iconActive]}>{segment.icon}</Text>
            ) : null}
            <Text style={[styles.label, isActive && styles.labelActive]}>{segment.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    gap: 5,
  },
  segmentActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadowStrong,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  labelActive: {
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  icon: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  iconActive: {
    color: Colors.primary,
  },
});
