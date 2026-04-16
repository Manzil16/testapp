import { useCallback, useMemo, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  BookingTimeline,
  PremiumCard,
  PrimaryCTA,
  ScreenContainer,
  SecondaryButton,
  SectionTitle,
  SkeletonBox,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { CountdownTimer } from "@/src/components/ui/CountdownTimer";
import { useBookingDetail } from "@/src/hooks/useBookingDetail";
import { updateBookingStatus, endSession } from "@/src/features/bookings/booking.repository";
import { cancelPayment, processRefund } from "@/src/services/stripeService";
import type { BookingStatus } from "@/src/features/bookings/booking.types";

const STATUS_CONFIG: Record<
  string,
  { color: string; headerText: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  requested: { color: Colors.warning, headerText: "Waiting for host", icon: "time" },
  approved: { color: Colors.accent, headerText: "Booking confirmed", icon: "checkmark-circle" },
  active: { color: Colors.info, headerText: "Charging in progress", icon: "flash" },
  missed: { color: Colors.error, headerText: "Session missed", icon: "alert-circle" },
  completed: { color: Colors.success, headerText: "All done!", icon: "checkmark-done-circle" },
  cancelled: { color: "#9CA3AF", headerText: "Booking cancelled", icon: "close-circle" },
  expired: { color: "#9CA3AF", headerText: "Booking expired", icon: "timer" },
  declined: { color: Colors.error, headerText: "Booking declined", icon: "close-circle" },
};

export default function BookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { booking, charger, isLoading, refetch } = useBookingDetail(bookingId!);
  const [actionLoading, setActionLoading] = useState(false);
  const [showKwhModal, setShowKwhModal] = useState(false);
  const [kwhEntry, setKwhEntry] = useState("");

  const config = STATUS_CONFIG[booking?.status ?? "requested"] ?? STATUS_CONFIG.requested;

  const hoursUntilStart = useMemo(() => {
    if (!booking) return 0;
    return Math.max(0, (new Date(booking.startTimeIso).getTime() - Date.now()) / (1000 * 60 * 60));
  }, [booking]);

  const handleCancel = useCallback(async () => {
    if (!booking) return;
    setActionLoading(true);
    try {
      await updateBookingStatus(booking.id, "cancelled");
      if (booking.stripePaymentIntentId) {
        if (hoursUntilStart > 2) {
          await cancelPayment(booking.stripePaymentIntentId);
        } else {
          await processRefund(booking.id);
        }
      }
      refetch();
    } finally {
      setActionLoading(false);
    }
  }, [booking, hoursUntilStart, refetch]);

  const performEndSession = useCallback(async (kwh: number) => {
    if (!booking) return;
    setActionLoading(true);
    try {
      await endSession(booking.id, kwh);
      refetch();
    } finally {
      setActionLoading(false);
    }
  }, [booking, refetch]);

  const handleEndSession = useCallback(() => {
    if (!booking) return;
    Alert.alert(
      "End Session Early?",
      "This will finalize your charging session and process payment based on actual usage. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Session",
          onPress: () => {
            if (booking.actualKWh != null) {
              void performEndSession(booking.actualKWh);
            } else {
              setKwhEntry(String(booking.estimatedKWh));
              setShowKwhModal(true);
            }
          },
        },
      ]
    );
  }, [booking, performEndSession]);

  const confirmKwhAndEnd = useCallback(async () => {
    setShowKwhModal(false);
    const kwh = Math.max(0, Number(kwhEntry) || (booking?.estimatedKWh ?? 0));
    await performEndSession(kwh);
  }, [kwhEntry, booking, performEndSession]);

  const handleDirections = useCallback(() => {
    if (!charger) return;
    const url = Platform.select({
      ios: `maps:?daddr=${charger.latitude},${charger.longitude}`,
      android: `google.navigation:q=${charger.latitude},${charger.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${charger.latitude},${charger.longitude}`,
    });
    if (url) Linking.openURL(url);
  }, [charger]);

  const handleRebook = useCallback(() => {
    if (charger) {
      router.push(`/(app)/chargers/${charger.id}` as any);
    } else {
      router.push("/(app)/(tabs)/discover" as any);
    }
  }, [charger, router]);

  if (isLoading || !booking) {
    return (
      <ScreenContainer>
        <SkeletonBox width="100%" height={120} />
        <SkeletonBox width="100%" height={200} style={{ marginTop: Spacing.md }} />
        <SkeletonBox width="100%" height={150} style={{ marginTop: Spacing.md }} />
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenContainer bottomInset={90}>
        {/* Status Header */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.statusHeader, { backgroundColor: config.color }]}
        >
          <View style={styles.statusIconRow}>
            <Ionicons name={config.icon} size={28} color={Colors.textInverse} />
            {booking.status === "active" && <View style={styles.pulseDot} />}
          </View>
          <Text style={styles.statusText}>{config.headerText}</Text>
        </Animated.View>

        {/* Countdown Timer */}
        {booking.status === "requested" && booking.expiresAtIso && (
          <Animated.View entering={FadeInDown.delay(60).duration(260)}>
            <PremiumCard style={styles.section}>
              <CountdownTimer
                targetIso={booking.expiresAtIso}
                label="until booking expires"
              />
            </PremiumCard>
          </Animated.View>
        )}

        {booking.status === "approved" && (
          <Animated.View entering={FadeInDown.delay(60).duration(260)}>
            <PremiumCard style={styles.section}>
              <CountdownTimer
                targetIso={booking.startTimeIso}
                label="until session starts"
              />
              <Text style={styles.graceNote}>
                15 min grace period after start time
              </Text>
            </PremiumCard>
          </Animated.View>
        )}

        {/* Booking Timeline */}
        <Animated.View entering={FadeInDown.delay(120).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Status" topSpacing={Spacing.xs} />
            <BookingTimeline status={booking.status as any} />
          </PremiumCard>
        </Animated.View>

        {/* Charger Info */}
        {charger && (
          <Animated.View entering={FadeInDown.delay(180).duration(260)}>
            <PremiumCard style={styles.section}>
              <SectionTitle title="Charger" topSpacing={Spacing.xs} />
              <Text style={Typography.cardTitle}>{charger.name}</Text>
              <Text style={Typography.body}>{charger.address}</Text>
              <View style={styles.specRow}>
                <View style={styles.specItem}>
                  <Ionicons name="flash" size={16} color={Colors.accent} />
                  <Text style={Typography.body}>{charger.maxPowerKw}kW</Text>
                </View>
                <View style={styles.specItem}>
                  <Ionicons name="hardware-chip" size={16} color={Colors.accent} />
                  <Text style={Typography.body}>
                    {charger.connectors.map((c) => c.type).join(", ")}
                  </Text>
                </View>
              </View>
              {(booking.status === "approved" || booking.status === "active") && (
                <SecondaryButton
                  label="Get directions"
                  onPress={handleDirections}
                  icon="navigate"
                  style={styles.directionsBtn}
                />
              )}
            </PremiumCard>
          </Animated.View>
        )}

        {/* Cost Breakdown */}
        <Animated.View entering={FadeInDown.delay(240).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Cost breakdown" topSpacing={Spacing.xs} />
            <View style={styles.costRow}>
              <Text style={Typography.body}>Estimated kWh</Text>
              <Text style={Typography.body}>{booking.estimatedKWh} kWh</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={Typography.body}>Rate</Text>
              <Text style={Typography.body}>
                ${charger ? charger.pricingPerKwh.toFixed(2) : "—"}/kWh
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={Typography.body}>Subtotal</Text>
              <Text style={Typography.body}>
                ${booking.subtotalAmount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={Typography.body}>Platform fee</Text>
              <Text style={Typography.body}>
                ${booking.platformFee.toFixed(2)}
              </Text>
            </View>
            <View style={styles.costDivider} />
            <View style={styles.costRow}>
              <Text style={styles.costTotalLabel}>
                {booking.status === "completed" ? "Final charge" : "Auth hold"}
              </Text>
              <Text style={styles.costTotalValue}>
                ${(booking.actualAmount ?? booking.totalAmount).toFixed(2)}
              </Text>
            </View>

            {booking.status === "completed" && booking.actualKWh != null && (
              <>
                <View style={styles.costDivider} />
                <View style={styles.costRow}>
                  <Text style={Typography.body}>Actual kWh used</Text>
                  <Text style={Typography.body}>{booking.actualKWh} kWh</Text>
                </View>
                {booking.actualAmount != null &&
                  booking.actualAmount < booking.totalAmount && (
                    <View style={styles.costRow}>
                      <Text style={[Typography.body, { color: Colors.success }]}>
                        Released back
                      </Text>
                      <Text style={[Typography.body, { color: Colors.success }]}>
                        ${(booking.totalAmount - booking.actualAmount).toFixed(2)}
                      </Text>
                    </View>
                  )}
              </>
            )}

            {(booking.status === "approved" || booking.status === "requested") && (
              <Text style={styles.costNote}>
                Final charge based on actual kWh used
              </Text>
            )}
          </PremiumCard>
        </Animated.View>

        {/* Status-specific info */}
        {booking.status === "missed" && (
          <Animated.View entering={FadeInDown.delay(300).duration(260)}>
            <PremiumCard style={[styles.section, { backgroundColor: Colors.errorLight }]}>
              <Ionicons name="alert-circle" size={24} color={Colors.error} />
              <Text style={[Typography.body, { marginTop: Spacing.sm }]}>
                You didn't arrive within the 15-minute grace period.
                The hold on your card has been released.
              </Text>
            </PremiumCard>
          </Animated.View>
        )}

        {booking.status === "expired" && (
          <Animated.View entering={FadeInDown.delay(300).duration(260)}>
            <PremiumCard style={styles.section}>
              <Text style={Typography.body}>
                The host didn't respond within 24 hours. The hold on your card has
                been fully released.
              </Text>
            </PremiumCard>
          </Animated.View>
        )}

        {booking.status === "declined" && (
          <Animated.View entering={FadeInDown.delay(300).duration(260)}>
            <PremiumCard style={[styles.section, { backgroundColor: Colors.errorLight }]}>
              <Text style={Typography.cardTitle}>Host declined your booking</Text>
              {booking.cancellationReason && (
                <Text style={[Typography.body, { marginTop: Spacing.xs }]}>
                  Reason: {booking.cancellationReason}
                </Text>
              )}
              <Text style={[Typography.body, { marginTop: Spacing.xs }]}>
                No charge was made — the hold has been released.
              </Text>
            </PremiumCard>
          </Animated.View>
        )}

        {booking.status === "cancelled" && (
          <Animated.View entering={FadeInDown.delay(300).duration(260)}>
            <PremiumCard style={styles.section}>
              {booking.cancellationReason && (
                <Text style={Typography.body}>
                  Reason: {booking.cancellationReason}
                </Text>
              )}
              <Text style={[Typography.body, { marginTop: Spacing.xs }]}>
                {hoursUntilStart > 2
                  ? "Full refund has been processed."
                  : "50% refund has been processed."}
              </Text>
            </PremiumCard>
          </Animated.View>
        )}
      </ScreenContainer>

      {/* kWh entry modal — shown when actual kWh is unknown at session end */}
      <Modal visible={showKwhModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Enter kWh Used</Text>
            <Text style={styles.modalBody}>
              Enter the actual kWh delivered. The estimated value is pre-filled as a fallback.
            </Text>
            <TextInput
              style={styles.kwhInput}
              value={kwhEntry}
              onChangeText={setKwhEntry}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowKwhModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmBtn}
                onPress={confirmKwhAndEnd}
              >
                <Text style={styles.modalConfirmText}>Confirm & End</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom action bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        {booking.status === "requested" && (
          <PrimaryCTA
            label="Cancel booking"
            onPress={handleCancel}
            loading={actionLoading}
            variant="danger"
          />
        )}
        {booking.status === "approved" && (
          <View style={styles.actionRow}>
            <SecondaryButton
              label="Cancel"
              onPress={handleCancel}
              loading={actionLoading}
              style={styles.actionHalf}
            />
            <PrimaryCTA
              label="Get directions"
              onPress={handleDirections}
              style={styles.actionHalf}
            />
          </View>
        )}
        {booking.status === "active" && (
          <PrimaryCTA
            label="End session early"
            onPress={handleEndSession}
            loading={actionLoading}
          />
        )}
        {(booking.status === "completed" ||
          booking.status === "missed" ||
          booking.status === "cancelled" ||
          booking.status === "expired" ||
          booking.status === "declined") && (
          <View style={styles.actionRow}>
            <PrimaryCTA
              label="Book again"
              onPress={handleRebook}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  statusHeader: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statusIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.textInverse,
  },
  statusText: {
    ...Typography.sectionTitle,
    color: Colors.textInverse,
    marginTop: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.md,
  },
  graceNote: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  specRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  directionsBtn: {
    marginTop: Spacing.md,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  costDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  costTotalLabel: {
    ...Typography.cardTitle,
    fontWeight: "700",
  },
  costTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.accent,
  },
  costNote: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    ...Shadows.card,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionHalf: {
    flex: 1,
  },
  // kWh entry modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalBox: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.card,
  },
  modalTitle: {
    ...Typography.sectionTitle,
    fontSize: 17,
    marginBottom: Spacing.sm,
  },
  modalBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  kwhInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textInverse,
  },
});
