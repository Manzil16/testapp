import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "./BottomSheet";
import { InputField } from "../forms/InputField";
import { PrimaryCTA } from "../ui/PrimaryCTA";
import { SecondaryButton } from "../ui/SecondaryButton";
import { Colors, Radius, Spacing, Typography } from "@/src/features/shared/theme";

const REASONS = [
  "Change of plans",
  "Found a closer charger",
  "Vehicle issue",
  "Schedule conflict",
  "Price too high",
  "Other",
] as const;

interface CancellationSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  bookingInfo?: {
    chargerName: string;
    scheduledAt: string;
  };
}

export function CancellationSheet({
  visible,
  onClose,
  onConfirm,
  loading = false,
  bookingInfo,
}: CancellationSheetProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");

  const finalReason =
    selectedReason === "Other"
      ? customReason.trim()
      : selectedReason ?? "";

  const canSubmit = finalReason.length > 0;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm(finalReason);
    setSelectedReason(null);
    setCustomReason("");
  };

  const handleClose = () => {
    setSelectedReason(null);
    setCustomReason("");
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title="Cancel Booking"
      subtitle={
        bookingInfo
          ? `${bookingInfo.chargerName} · ${new Date(bookingInfo.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
          : undefined
      }
      snapRatio={0.7}
    >
      <Text style={styles.prompt}>Why are you cancelling?</Text>

      <View style={styles.reasonGrid}>
        {REASONS.map((reason) => (
          <Pressable
            key={reason}
            style={[
              styles.reasonChip,
              selectedReason === reason && styles.reasonChipActive,
            ]}
            onPress={() => setSelectedReason(reason)}
          >
            <Text
              style={[
                styles.reasonChipText,
                selectedReason === reason && styles.reasonChipTextActive,
              ]}
            >
              {reason}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedReason === "Other" && (
        <InputField
          label="Please specify"
          value={customReason}
          onChangeText={setCustomReason}
          placeholder="Tell us why you're cancelling..."
          multiline
        />
      )}

      <View style={styles.actions}>
        <SecondaryButton
          label="Go Back"
          onPress={handleClose}
          style={styles.actionHalf}
        />
        <PrimaryCTA
          label="Cancel Booking"
          onPress={handleConfirm}
          loading={loading}
          disabled={!canSubmit}
          variant="danger"
          style={styles.actionHalf}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  prompt: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  reasonChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  reasonChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  reasonChipText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  reasonChipTextActive: {
    color: Colors.textInverse,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionHalf: {
    flex: 1,
  },
});
