import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Typography, Spacing, Radius, Shadows } from "@/src/features/shared/theme";

interface DateTimeInputProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode?: "date" | "time" | "datetime";
}

export function DateTimeInput({ label, value, onChange, mode = "datetime" }: DateTimeInputProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  const displayText = mode === "time"
    ? value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : mode === "date"
    ? value.toLocaleDateString()
    : `${value.toLocaleDateString()} ${value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  function handleConfirm() {
    onChange(tempDate);
    setShowPicker(false);
  }

  function adjustHours(delta: number) {
    const next = new Date(tempDate);
    next.setHours(next.getHours() + delta);
    setTempDate(next);
  }

  function adjustMinutes(delta: number) {
    const next = new Date(tempDate);
    next.setMinutes(next.getMinutes() + delta);
    setTempDate(next);
  }

  function adjustDays(delta: number) {
    const next = new Date(tempDate);
    next.setDate(next.getDate() + delta);
    setTempDate(next);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.inputBox} onPress={() => { setTempDate(value); setShowPicker(true); }}>
        <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
        <Text style={styles.inputText}>{displayText}</Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {(mode === "date" || mode === "datetime") && (
              <View style={styles.pickerSection}>
                <Text style={styles.pickerLabel}>Date</Text>
                <View style={styles.spinnerRow}>
                  <TouchableOpacity style={styles.spinnerBtn} onPress={() => adjustDays(-1)}>
                    <Ionicons name="remove" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.spinnerValue}>{tempDate.toLocaleDateString()}</Text>
                  <TouchableOpacity style={styles.spinnerBtn} onPress={() => adjustDays(1)}>
                    <Ionicons name="add" size={20} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {(mode === "time" || mode === "datetime") && (
              <View style={styles.pickerSection}>
                <Text style={styles.pickerLabel}>Time</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeCol}>
                    <TouchableOpacity style={styles.spinnerBtn} onPress={() => adjustHours(1)}>
                      <Ionicons name="chevron-up" size={20} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.timeValue}>{String(tempDate.getHours()).padStart(2, "0")}</Text>
                    <TouchableOpacity style={styles.spinnerBtn} onPress={() => adjustHours(-1)}>
                      <Ionicons name="chevron-down" size={20} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.timeSeparator}>:</Text>
                  <View style={styles.timeCol}>
                    <TouchableOpacity style={styles.spinnerBtn} onPress={() => adjustMinutes(15)}>
                      <Ionicons name="chevron-up" size={20} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.timeValue}>{String(tempDate.getMinutes()).padStart(2, "0")}</Text>
                    <TouchableOpacity style={styles.spinnerBtn} onPress={() => adjustMinutes(-15)}>
                      <Ionicons name="chevron-down" size={20} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  inputText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    paddingBottom: 40,
    ...Shadows.modal,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  modalTitle: {
    ...Typography.sectionTitle,
  },
  pickerSection: {
    marginBottom: Spacing.xxl,
  },
  pickerLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  spinnerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
  },
  spinnerBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: "600",
    minWidth: 120,
    textAlign: "center",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  timeCol: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  timeValue: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.textPrimary,
    minWidth: 44,
    textAlign: "center",
  },
  timeSeparator: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.textMuted,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    ...Shadows.button,
  },
  confirmText: {
    color: Colors.textInverse,
    fontWeight: "700",
    fontSize: 16,
  },
});
