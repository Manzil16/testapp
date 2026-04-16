import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import {
  GradientButton,
  PremiumCard,
  SecondaryButton,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookingId: string;
    chargerName: string;
    totalAmount: string;
    last4: string;
    brand: string;
  }>();

  const totalAmount = Number(params.totalAmount) || 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container}>
        {/* Success animation */}
        <Animated.View entering={ZoomIn.delay(200).duration(400)} style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={48} color={Colors.surface} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(300)}>
          <Text style={styles.title}>Booking Requested!</Text>
          <Text style={styles.subtitle}>
            Your payment is authorized and held. You'll only be charged when the host approves.
          </Text>
        </Animated.View>

        {/* Receipt card */}
        <Animated.View entering={FadeInDown.delay(600).duration(300)}>
          <PremiumCard style={styles.receipt}>
            <View style={styles.receiptHeader}>
              <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
              <Text style={styles.receiptTitle}>Payment Receipt</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Charger</Text>
              <Text style={styles.receiptValue} numberOfLines={1}>
                {params.chargerName || "EV Charger"}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Booking ID</Text>
              <Text style={styles.receiptValue}>
                #{(params.bookingId || "").slice(0, 8).toUpperCase()}
              </Text>
            </View>

            {params.last4 ? (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Paid with</Text>
                <View style={styles.cardRow}>
                  <Ionicons name="card" size={16} color={Colors.textSecondary} />
                  <Text style={styles.receiptValue}>
                    {(params.brand || "Card").charAt(0).toUpperCase() + (params.brand || "card").slice(1)} ****{params.last4}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptTotalLabel}>Amount Authorized</Text>
              <Text style={styles.receiptTotalValue}>${totalAmount.toFixed(2)} AUD</Text>
            </View>

            <View style={styles.statusRow}>
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.statusText}>Authorization Held</Text>
              </View>
              <Text style={styles.timestampText}>
                {new Date().toLocaleString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </PremiumCard>
        </Animated.View>

        {/* What happens next */}
        <Animated.View entering={FadeInDown.delay(800).duration(300)}>
          <PremiumCard style={styles.nextSteps}>
            <Text style={styles.nextTitle}>What happens next?</Text>
            <View style={styles.stepRow}>
              <View style={styles.stepDot}>
                <Text style={styles.stepNum}>1</Text>
              </View>
              <Text style={Typography.body}>Host will confirm your time slot</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepDot}>
                <Text style={styles.stepNum}>2</Text>
              </View>
              <Text style={Typography.body}>You'll receive a notification when approved</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepDot}>
                <Text style={styles.stepNum}>3</Text>
              </View>
              <Text style={Typography.body}>Navigate to the charger and start charging!</Text>
            </View>
          </PremiumCard>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeIn.delay(1000).duration(300)} style={styles.actions}>
          <GradientButton
            label="View My Bookings"
            onPress={() =>
              router.replace({
                pathname: "/(app)/(tabs)/bookings" as any,
                params: { segment: "upcoming" },
              })
            }
            style={styles.primaryBtn}
          />
          <SecondaryButton
            label="Back to Discover"
            onPress={() => router.replace("/(app)/(tabs)/discover" as any)}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
  },
  // Icon
  iconWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },
  // Title
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  // Receipt
  receipt: {
    marginBottom: Spacing.md,
  },
  receiptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  receiptTitle: {
    ...Typography.cardTitle,
    fontWeight: "700",
  },
  receiptDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  receiptLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  receiptValue: {
    ...Typography.body,
    fontWeight: "600",
    maxWidth: "60%",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  receiptTotalLabel: {
    ...Typography.cardTitle,
    fontWeight: "700",
  },
  receiptTotalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.success,
  },
  timestampText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  // Next steps
  nextSteps: {
    marginBottom: Spacing.lg,
  },
  nextTitle: {
    ...Typography.cardTitle,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.surface,
  },
  // Actions
  actions: {
    gap: Spacing.sm,
  },
  primaryBtn: {
    width: "100%",
  },
});
