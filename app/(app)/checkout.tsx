import { useCallback, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  GradientButton,
  PremiumCard,
  ScreenContainer,
  SectionTitle,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { AppConfig } from "@/src/constants/app";
import { createPaymentIntent } from "@/src/services/stripeService";
import { createBookingRequest, updateBookingStatus } from "@/src/features/bookings/booking.repository";
import { useAuth } from "@/src/features/auth/auth-context";

/**
 * Checkout screen — authorizes payment via Stripe.
 *
 * In production (native build): uses @stripe/stripe-react-native PaymentSheet.
 * In development (Expo Go): simulates the authorization flow since
 * @stripe/stripe-react-native requires a native build with config plugin.
 *
 * The PaymentIntent is always created server-side with capture_method: 'manual',
 * so funds are authorized (held) but not charged until host approval.
 */
export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const params = useLocalSearchParams<{
    chargerId: string;
    hostUserId: string;
    startTimeIso: string;
    endTimeIso: string;
    chargerName: string;
    chargerLat: string;
    chargerLng: string;
    totalAmount: string;
    platformFee: string;
    estimatedKWh: string;
    pricePerKwh: string;
    hostStripeAccountId: string;
  }>();

  const totalAmount = Number(params.totalAmount) || 0;
  const platformFee = Number(params.platformFee) || 0;
  const estimatedKWh = Number(params.estimatedKWh) || 0;
  const pricePerKwh = Number(params.pricePerKwh) || 0;
  const subtotal = pricePerKwh * estimatedKWh;

  const startDate = params.startTimeIso ? new Date(params.startTimeIso) : null;
  const endDate = params.endTimeIso ? new Date(params.endTimeIso) : null;
  const durationMinutes =
    startDate && endDate ? Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000)) : 0;
  const durationLabel = formatDuration(durationMinutes);
  const sameDay =
    startDate && endDate && startDate.toDateString() === endDate.toDateString();

  const [processing, setProcessing] = useState(false);

  const handleAuthorizePayment = useCallback(async () => {
    if (!user || !params.chargerId || !params.hostUserId || !totalAmount) {
      Alert.alert("Missing information", "Required booking details are missing. Please go back and try again.");
      return;
    }
    if (!params.hostStripeAccountId) {
      Alert.alert("Payment unavailable", "This host has not finished setting up payments. Please choose another charger.");
      return;
    }

    setProcessing(true);
    let createdBookingId: string | null = null;
    try {
      // Step 1: Create the booking record — only now, when the user actively authorises
      const result = await createBookingRequest({
        chargerId: params.chargerId,
        driverUserId: user.id,
        hostUserId: params.hostUserId,
        startTimeIso: params.startTimeIso,
        endTimeIso: params.endTimeIso,
        estimatedKWh,
      });

      if ("conflict" in result) {
        Alert.alert("Slot taken", "This time slot was just booked by someone else. Please choose a different time.");
        return;
      }
      if ("suspended" in result) {
        Alert.alert("Account suspended", "Your account has been suspended. Please contact support.");
        return;
      }
      if ("unverified" in result) {
        router.replace("/(app)/verification-required" as any);
        return;
      }
      if ("error" in result) {
        Alert.alert("Booking failed", result.error);
        return;
      }

      createdBookingId = result.bookingId;

      // Step 2: Authorise the payment hold via Stripe
      // In production: present PaymentSheet from @stripe/stripe-react-native here.
      const amountCents = Math.round(totalAmount * 100);
      const paymentIntent = await createPaymentIntent({
        bookingId: createdBookingId,
        amount: amountCents,
        hostStripeAccountId: params.hostStripeAccountId || "",
      });

      router.replace({
        pathname: "/(app)/payment-success" as any,
        params: {
          bookingId: createdBookingId,
          chargerName: params.chargerName,
          chargerLat: params.chargerLat ?? "",
          chargerLng: params.chargerLng ?? "",
          totalAmount: String(totalAmount),
          brand: paymentIntent.card?.brand || "",
          last4: paymentIntent.card?.last4 || "",
        },
      });
    } catch (err) {
      // If the booking was created but payment failed, cancel it immediately so the
      // slot is freed and no orphaned record blocks future bookings.
      if (createdBookingId) {
        try {
          await updateBookingStatus(createdBookingId, "cancelled", undefined, "Payment authorization failed");
        } catch {
          // Cancellation failed — booking will auto-expire after 24h via expires_at.
        }
      }
      const message = err instanceof Error ? err.message : "Payment authorization failed";
      Alert.alert("Payment Error", message);
    } finally {
      setProcessing(false);
    }
  }, [params, totalAmount, estimatedKWh, user, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer bottomInset={100}>
        {/* Booking Time — surfaced prominently before payment */}
        {startDate && endDate ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <PremiumCard style={styles.timeCard}>
              <View style={styles.timeHeaderRow}>
                <Ionicons name="calendar" size={18} color={Colors.primary} />
                <Text style={styles.timeHeader}>Your booking time</Text>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{durationLabel}</Text>
                </View>
              </View>
              <View style={styles.timeRangeRow}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeBlockLabel}>From</Text>
                  <Text style={styles.timeBlockValue}>{formatTime(startDate)}</Text>
                  <Text style={styles.timeBlockDate}>{formatDate(startDate)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={Colors.textMuted} />
                <View style={styles.timeBlock}>
                  <Text style={styles.timeBlockLabel}>To</Text>
                  <Text style={styles.timeBlockValue}>{formatTime(endDate)}</Text>
                  <Text style={styles.timeBlockDate}>
                    {sameDay ? "Same day" : formatDate(endDate)}
                  </Text>
                </View>
              </View>
            </PremiumCard>
          </Animated.View>
        ) : null}

        {/* Order Summary */}
        <Animated.View entering={FadeInDown.duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Order Summary" topSpacing={Spacing.xs} />
            <View style={styles.summaryRow}>
              <Ionicons name="flash" size={18} color={Colors.primary} />
              <Text style={[Typography.body, { flex: 1 }]} numberOfLines={1}>
                {params.chargerName || "EV Charger"}
              </Text>
            </View>

            <View style={styles.breakdownBox}>
              <View style={styles.breakdownRow}>
                <Text style={Typography.body}>
                  ${pricePerKwh.toFixed(2)} x {estimatedKWh} kWh
                </Text>
                <Text style={Typography.body}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={Typography.body}>
                  Platform fee ({AppConfig.PLATFORM_FEE_PERCENT}%)
                </Text>
                <Text style={Typography.body}>${platformFee.toFixed(2)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
              </View>
            </View>
          </PremiumCard>
        </Animated.View>

        {/* Payment info */}
        <Animated.View entering={FadeInDown.delay(80).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Payment" topSpacing={Spacing.xs} />
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
              <Text style={styles.infoText}>
                Your payment is secured by Stripe. Card details are handled directly by Stripe and never touch our servers.
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={16} color={Colors.primary} />
              <Text style={styles.infoText}>
                Your card will be authorized now. You will only be charged when the host approves your booking. If declined, the hold is released automatically.
              </Text>
            </View>
          </PremiumCard>
        </Animated.View>
      </ScreenContainer>

      {/* Pay button */}
      <View style={styles.payBar}>
        <View style={styles.payBarContent}>
          <View>
            <Text style={styles.payTotal}>${totalAmount.toFixed(2)} AUD</Text>
            <Text style={styles.paySubtext}>Authorization hold</Text>
          </View>
          <GradientButton
            label={processing ? "Processing..." : "Authorize Payment"}
            onPress={handleAuthorizePayment}
            loading={processing}
            disabled={processing}
            style={styles.payBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  section: {
    marginBottom: Spacing.md,
  },
  timeCard: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  timeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  timeHeader: {
    ...Typography.cardTitle,
    fontWeight: "700",
    flex: 1,
  },
  durationBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  durationText: {
    ...Typography.badge,
    color: Colors.primaryDark,
    fontWeight: "700",
  },
  timeRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  timeBlock: {
    flex: 1,
  },
  timeBlockLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  timeBlockValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginTop: 2,
  },
  timeBlockDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  breakdownBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  totalLabel: {
    ...Typography.cardTitle,
    fontWeight: "700",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.primary,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  infoText: {
    ...Typography.caption,
    color: Colors.textMuted,
    flex: 1,
  },
  payBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    ...Shadows.card,
  },
  payBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payTotal: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  paySubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  payBtn: {
    flex: 0,
    width: 180,
  },
});
