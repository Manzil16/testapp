import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Avatar,
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
import { useBookingDetail } from "@/src/hooks/useBookingDetail";
import { useHostBookings } from "@/src/hooks/useHostBookings";
import { useAuth } from "@/src/features/auth/auth-context";
import { supabase } from "@/src/lib/supabase";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "DMSans_400Regular",
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
    fontFamily: "DMSans_600SemiBold",
  },
});

export default function HostBookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = useMemo(() => user?.id, [user?.id]);

  const { booking, charger, isLoading, refetch } = useBookingDetail(bookingId!);
  const { actions } = useHostBookings(userId);

  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch driver profile
  const [driver, setDriver] = useState<{
    displayName: string;
    avatarUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (!booking?.driverUserId) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", booking.driverUserId)
      .single()
      .then(({ data }) => {
        if (data) setDriver({ displayName: data.display_name, avatarUrl: data.avatar_url ?? undefined });
      });
  }, [booking?.driverUserId]);

  const handleApprove = useCallback(async () => {
    if (!booking) return;
    Alert.alert("Approve Booking", "Confirm you want to approve this booking request.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          setActionLoading(true);
          try {
            await actions.approveBooking(booking, note.trim() || undefined);
            refetch();
            Alert.alert("Approved", "The booking has been approved.");
          } catch {
            Alert.alert("Error", "Could not approve booking. Try again.");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [booking, note, actions, refetch]);

  const handleDecline = useCallback(async () => {
    if (!booking) return;
    Alert.alert("Decline Booking", "Are you sure you want to decline this request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            await actions.declineBooking(booking, note.trim() || undefined);
            refetch();
            Alert.alert("Declined", "The booking has been declined.");
            router.back();
          } catch {
            Alert.alert("Error", "Could not decline booking. Try again.");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [booking, note, actions, refetch, router]);

  const handleMarkComplete = useCallback(async () => {
    if (!booking) return;
    Alert.alert("Mark Complete", "Mark this session as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          setActionLoading(true);
          try {
            await actions.markCompleted(booking, note.trim() || undefined);
            refetch();
            Alert.alert("Done", "Session marked as completed.");
          } catch {
            Alert.alert("Error", "Could not complete booking. Try again.");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [booking, note, actions, refetch]);

  const durationHours = useMemo(() => {
    if (!booking) return 0;
    const diff =
      new Date(booking.endTimeIso).getTime() -
      new Date(booking.startTimeIso).getTime();
    return diff / (1000 * 60 * 60);
  }, [booking]);

  const refundEligible = useMemo(() => {
    if (!booking) return false;
    const hoursUntilStart =
      (new Date(booking.startTimeIso).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilStart > 2;
  }, [booking]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScreenContainer>
          <SkeletonBox height={120} style={{ marginBottom: Spacing.md }} />
          <SkeletonBox height={200} style={{ marginBottom: Spacing.md }} />
          <SkeletonBox height={80} />
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScreenContainer>
          <Text style={[Typography.body, { textAlign: "center", marginTop: Spacing.xxxl }]}>
            Booking not found.
          </Text>
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  const isPending = booking.status === "requested";
  const isActive = booking.status === "approved" || booking.status === "active";
  const isDone = ["completed", "cancelled", "declined", "missed", "expired"].includes(
    booking.status
  );

  const STATUS_COLORS: Record<string, string> = {
    requested: Colors.warning,
    approved: Colors.primary,
    active: Colors.info,
    completed: Colors.success,
    cancelled: Colors.textMuted,
    declined: Colors.error,
    missed: Colors.error,
    expired: Colors.textMuted,
  };

  const STATUS_LABELS: Record<string, string> = {
    requested: "Awaiting your response",
    approved: "Booking approved",
    active: "Session in progress",
    completed: "Session completed",
    cancelled: "Cancelled by driver",
    declined: "You declined",
    missed: "Driver didn't arrive",
    expired: "Request expired",
  };

  const statusColor = STATUS_COLORS[booking.status] ?? Colors.textMuted;
  const statusLabel = STATUS_LABELS[booking.status] ?? booking.status;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.statusBanner, { backgroundColor: statusColor + "18", borderColor: statusColor + "40" }]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </Animated.View>

        {/* Driver profile */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <PremiumCard style={styles.driverCard}>
            <SectionTitle title="Driver" />
            <View style={styles.driverRow}>
              <Avatar
                uri={driver?.avatarUrl}
                name={driver?.displayName ?? "Driver"}
                size="md"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{driver?.displayName ?? "Loading…"}</Text>
                <Text style={styles.driverMeta}>
                  {booking.estimatedKWh} kWh requested ·{" "}
                  {durationHours.toFixed(1)}h session
                </Text>
              </View>
            </View>
          </PremiumCard>
        </Animated.View>

        {/* Booking timeline */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Status" />
            <BookingTimeline status={booking.status as any} />
          </PremiumCard>
        </Animated.View>

        {/* Booking details */}
        <Animated.View entering={FadeInDown.delay(180).duration(300)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Booking Details" />
            <DetailRow label="Charger" value={charger?.name ?? "—"} />
            <DetailRow label="Start" value={formatDateTime(booking.startTimeIso)} />
            <DetailRow label="End" value={formatDateTime(booking.endTimeIso)} />
            <DetailRow label="Duration" value={`${durationHours.toFixed(1)} hours`} />
            <DetailRow label="Est. kWh" value={`${booking.estimatedKWh} kWh`} />
            {booking.note ? <DetailRow label="Note" value={booking.note} /> : null}
          </PremiumCard>
        </Animated.View>

        {/* Payment breakdown */}
        <Animated.View entering={FadeInDown.delay(240).duration(300)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Payment" />
            <DetailRow
              label="Subtotal"
              value={`$${booking.subtotalAmount.toFixed(2)}`}
            />
            <DetailRow
              label="Platform fee"
              value={`$${booking.platformFee.toFixed(2)}`}
            />
            <View style={[rowStyles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>Auth hold</Text>
              <Text style={styles.totalValue}>${booking.totalAmount.toFixed(2)}</Text>
            </View>
            {booking.actualAmount != null && (
              <View style={[rowStyles.row, styles.totalRow]}>
                <Text style={styles.totalLabel}>Final charge</Text>
                <Text style={[styles.totalValue, { color: Colors.success }]}>
                  ${booking.actualAmount.toFixed(2)}
                </Text>
              </View>
            )}
            {booking.hostPayoutAmount != null && (
              <View style={[rowStyles.row, styles.totalRow]}>
                <Text style={styles.totalLabel}>Your payout</Text>
                <Text style={[styles.totalValue, { color: Colors.primary }]}>
                  ${booking.hostPayoutAmount.toFixed(2)}
                </Text>
              </View>
            )}
            <Text style={styles.payoutNote}>
              Final payout based on actual kWh delivered, processed after session ends.
            </Text>
          </PremiumCard>
        </Animated.View>

        {/* Cancellation reason (if any) */}
        {booking.cancellationReason ? (
          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <PremiumCard style={styles.section}>
              <SectionTitle title="Cancellation Reason" />
              <Text style={styles.cancelReason}>{booking.cancellationReason}</Text>
            </PremiumCard>
          </Animated.View>
        ) : null}

        {/* Note input for actions */}
        {(isPending || isActive) && (
          <Animated.View entering={FadeInDown.delay(360).duration(300)}>
            <PremiumCard style={styles.section}>
              <SectionTitle title="Add a note (optional)" />
              <TextInput
                style={styles.noteInput}
                placeholder="e.g. Use the side entrance..."
                placeholderTextColor={Colors.textMuted}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
            </PremiumCard>
          </Animated.View>
        )}

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Sticky action bar */}
      {!isDone && (
        <View
          style={[
            styles.stickyBar,
            { paddingBottom: insets.bottom + Spacing.md },
          ]}
        >
          {isPending && (
            <>
              <PrimaryCTA
                label="Approve"
                onPress={handleApprove}
                loading={actionLoading}
                style={{ flex: 1 }}
              />
              <SecondaryButton
                label="Decline"
                onPress={handleDecline}
                loading={actionLoading}
                style={{ flex: 1 }}
              />
            </>
          )}
          {isActive && (
            <PrimaryCTA
              label="Mark session complete"
              onPress={handleMarkComplete}
              loading={actionLoading}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },

  // Status banner
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "DMSans_700Bold",
  },

  // Driver
  driverCard: {
    marginBottom: Spacing.lg,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    fontFamily: "DMSans_700Bold",
    marginBottom: 2,
  },
  driverMeta: {
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: "DMSans_400Regular",
  },

  section: {
    marginBottom: Spacing.lg,
  },

  // Total row
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: Spacing.md,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    fontFamily: "DMSans_700Bold",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    fontFamily: "Syne_700Bold",
  },
  payoutNote: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: "DMSans_400Regular",
    marginTop: Spacing.sm,
    lineHeight: 16,
  },

  // Cancel reason
  cancelReason: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "DMSans_400Regular",
    lineHeight: 20,
  },

  // Note input
  noteInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },

  // Sticky bar
  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    ...Shadows.card,
  },
});
