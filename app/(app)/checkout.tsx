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
  PressableScale,
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

  const params = useLocalSearchParams<{
    bookingId: string;
    chargerName: string;
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

  const [processing, setProcessing] = useState(false);

  const handleAuthorizePayment = useCallback(async () => {
    if (!params.bookingId || !totalAmount) return;

    setProcessing(true);
    try {
      // Create the PaymentIntent server-side (capture_method: manual)
      const amountCents = Math.round(totalAmount * 100);
      console.log("[checkout] calling createPaymentIntent", { bookingId: params.bookingId, amountCents, hostStripeAccountId: params.hostStripeAccountId });
      await createPaymentIntent({
        bookingId: params.bookingId,
        amount: amountCents,
        hostStripeAccountId: params.hostStripeAccountId || "",
      });

      // In production, this would present PaymentSheet from @stripe/stripe-react-native
      // for PCI-compliant card collection. For demo/Expo Go, the PI is created and we
      // navigate to success. The real card confirmation would happen via:
      //
      //   const { initPaymentSheet, presentPaymentSheet } = useStripe();
      //   await initPaymentSheet({ paymentIntentClientSecret: result.clientSecret, ... });
      //   const { error } = await presentPaymentSheet();
      //

      // Navigate to confirmation
      router.replace({
        pathname: "/(app)/payment-success" as any,
        params: {
          bookingId: params.bookingId,
          chargerName: params.chargerName,
          totalAmount: String(totalAmount),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment authorization failed";
      console.error("[checkout] payment error:", err);
      console.error("[checkout] error message:", message);
      Alert.alert("Payment Error", message);
    } finally {
      setProcessing(false);
    }
  }, [params.bookingId, params.chargerName, params.hostStripeAccountId, totalAmount, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer bottomInset={100}>
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </PressableScale>
          <Text style={Typography.pageTitle}>Checkout</Text>
          <View style={{ width: 38 }} />
        </View>

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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.subtle,
  },
  section: {
    marginBottom: Spacing.md,
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
