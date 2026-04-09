/**
 * onboarding.tsx
 *
 * First-login onboarding screen — shown once per user per device, then never again.
 *
 * DRIVER  → Prompts to save a payment card via Stripe Checkout (setup mode).
 *           Opens in the device browser; no native Stripe SDK required.
 *
 * HOST    → Prompts to connect a Stripe Express account for payouts.
 *           Reuses the existing stripe-connect-onboard edge function.
 *
 * Both roles have a "Skip for now" link. Skipping marks the screen as seen
 * so it won't appear on subsequent logins.
 *
 * After setup (or skip) the user is navigated to their role home screen.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  ScreenContainer,
  PrimaryCTA,
  PremiumCard,
  Typography,
  Colors,
  Spacing,
  Radius,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { getVerificationGate } from "@/src/features/verification/verification-gates.repository";
import type { VerificationGate } from "@/src/features/verification/verification-gates.types";
import {
  setupPaymentMethod,
  createConnectAccount,
  getConnectAccountStatus,
  isStripeNotConfiguredError,
} from "@/src/services/stripeService";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Phase = "idle" | "opening" | "checking" | "success";

// ─── Content per role ────────────────────────────────────────────────────────

const DRIVER_CONTENT = {
  icon: "card-outline" as const,
  title: "Add your payment method",
  subtitle:
    "Save a card now so booking is instant — you're only charged after your session ends based on actual kWh used.",
  benefits: [
    { icon: "flash-outline" as const,          text: "One-tap booking, no checkout friction" },
    { icon: "shield-checkmark-outline" as const, text: "Card stored securely by Stripe" },
    { icon: "calculator-outline" as const,     text: "Only charged for kWh actually delivered" },
  ],
  cta: "Add payment card",
  successTitle: "Card saved!",
  successSubtitle: "You're ready to book any charger on VehicleGrid.",
  alreadyTitle: "Payment method on file",
  alreadySubtitle: "Your card is already saved. You're good to go.",
};

const HOST_CONTENT = {
  icon: "wallet-outline" as const,
  title: "Connect your payout account",
  subtitle:
    "Set up a Stripe account so you can receive payments when drivers use your charger. Takes about 5 minutes.",
  benefits: [
    { icon: "cash-outline" as const,           text: "Receive payouts directly to your bank" },
    { icon: "time-outline" as const,           text: "Earnings processed within 2 business days" },
    { icon: "lock-closed-outline" as const,    text: "Powered by Stripe — bank-grade security" },
  ],
  cta: "Connect Stripe",
  successTitle: "Stripe connected!",
  successSubtitle: "Your payout account is ready. Approve bookings and start earning.",
  alreadyTitle: "Payout account connected",
  alreadySubtitle: "Your Stripe account is already linked. You're all set.",
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile, markOnboardingDone } = useAuth();

  const isHost = profile?.role === "host";
  const content = isHost ? HOST_CONTENT : DRIVER_CONTENT;

  const [gate, setGate] = useState<VerificationGate | null>(null);
  const [gateLoading, setGateLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");

  // Stripe credentials modal (demo safety net — shown when STRIPE_SECRET_KEY is not set)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credPublishableKey, setCredPublishableKey] = useState("");
  const [credSecretKey, setCredSecretKey] = useState("");
  const pendingRetry = useRef<(() => void) | null>(null);

  // ── Check whether user already completed this step ────────────────────────
  const fetchGate = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const g = await getVerificationGate(profile.id);
      setGate(g);
    } catch {
      // gate table may not exist yet — treat as not set up
    } finally {
      setGateLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchGate();
  }, [fetchGate]);

  // Already set up (even without going through onboarding screen this session)
  const alreadyDone = isHost
    ? gate?.stripeOnboarded === true
    : gate?.paymentMethodAdded === true;

  // ── Re-check gate when app returns to foreground (after browser closes) ───
  useEffect(() => {
    if (phase !== "opening") return;

    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      if (nextState === "active") {
        setPhase("checking");
        await fetchGate();
        setPhase("success");
      }
    });
    return () => sub.remove();
  }, [phase, fetchGate]);

  // Auto-detect success from gate after checking
  useEffect(() => {
    if (phase === "success" || phase === "idle") return;
    if (alreadyDone) setPhase("success");
  }, [alreadyDone, phase]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const navigateHome = useCallback(async () => {
    await markOnboardingDone();
    const dest =
      profile?.role === "host"
        ? "/(app)/(tabs)/host-home"
        : "/(app)/(tabs)/dashboard";
    router.replace(dest as any);
  }, [markOnboardingDone, profile?.role, router]);

  // ── Action: open Stripe browser ───────────────────────────────────────────
  const handleSetUp = useCallback(async () => {
    if (!profile?.id) return;
    setPhase("opening");

    try {
      let url: string;

      if (isHost) {
        const result = await createConnectAccount(profile.id);
        url = result.onboardingUrl;
      } else {
        const result = await setupPaymentMethod(profile.id);
        url = result.sessionUrl;
      }

      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: Colors.accent,
      });

      // After browser is dismissed, re-check gate (AppState listener also fires)
      setPhase("checking");
      await fetchGate();
      setPhase("success");
    } catch (err) {
      setPhase("idle");
      if (isStripeNotConfiguredError(err)) {
        // Demo safety: ask for test credentials instead of crashing
        pendingRetry.current = handleSetUp;
        setShowCredentialsModal(true);
        return;
      }
      const msg = err instanceof Error ? err.message : "Could not open setup page";
      Alert.alert("Setup error", msg);
    }
  }, [profile?.id, isHost, fetchGate]);

  // ── Save demo credentials and retry ──────────────────────────────────────
  const handleCredentialsSubmit = useCallback(async () => {
    if (!credPublishableKey.trim() || !credSecretKey.trim()) {
      Alert.alert("Missing credentials", "Enter both the publishable key and secret key.");
      return;
    }
    try {
      await AsyncStorage.setItem("stripe_demo_publishable_key", credPublishableKey.trim());
      await AsyncStorage.setItem("stripe_demo_secret_key", credSecretKey.trim());
    } catch {
      // AsyncStorage failure is non-fatal for the demo
    }
    setShowCredentialsModal(false);
    setCredPublishableKey("");
    setCredSecretKey("");
    // Retry the original action
    if (pendingRetry.current) {
      pendingRetry.current();
      pendingRetry.current = null;
    }
  }, [credPublishableKey, credSecretKey]);

  // ── Render helpers ────────────────────────────────────────────────────────
  const isLoading  = gateLoading || phase === "opening" || phase === "checking";
  const showSuccess = !gateLoading && (alreadyDone || phase === "success");
  const ctaLabel   = phase === "opening"
    ? "Opening Stripe…"
    : phase === "checking"
    ? "Checking status…"
    : content.cta;

  return (
    <ScreenContainer>
      {/* ── Header ── */}
      <Animated.View entering={FadeInUp.duration(340)} style={styles.header}>
        <View style={styles.iconRing}>
          <Ionicons
            name={showSuccess ? "checkmark-circle" : content.icon}
            size={52}
            color={showSuccess ? Colors.success : Colors.accent}
          />
        </View>

        <Text style={[Typography.pageTitle, styles.title]}>
          {showSuccess
            ? alreadyDone ? content.alreadyTitle : content.successTitle
            : content.title}
        </Text>

        <Text style={[Typography.body, styles.subtitle]}>
          {showSuccess
            ? alreadyDone ? content.alreadySubtitle : content.successSubtitle
            : content.subtitle}
        </Text>
      </Animated.View>

      {/* ── Benefits list (only when not yet done) ── */}
      {!showSuccess && (
        <Animated.View entering={FadeInDown.delay(80).duration(300)}>
          <PremiumCard style={styles.benefitsCard}>
            {content.benefits.map((b, i) => (
              <View key={i} style={[styles.benefitRow, i > 0 && styles.benefitDivider]}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={20} color={Colors.accent} />
                </View>
                <Text style={[Typography.body, styles.benefitText]}>{b.text}</Text>
              </View>
            ))}
          </PremiumCard>
        </Animated.View>
      )}

      {/* ── Success card ── */}
      {showSuccess && (
        <Animated.View entering={FadeInDown.duration(300)}>
          <PremiumCard style={styles.successCard}>
            <View style={styles.benefitRow}>
              <View style={[styles.benefitIcon, styles.successIcon]}>
                <Ionicons name="checkmark" size={20} color={Colors.textInverse} />
              </View>
              <Text style={[Typography.body, styles.benefitText]}>
                {isHost ? "Stripe Connect account linked" : "Card on file — ready to book"}
              </Text>
            </View>
          </PremiumCard>
        </Animated.View>
      )}

      {/* ── Role badge ── */}
      <Animated.View entering={FadeInDown.delay(160).duration(300)} style={styles.roleBadge}>
        <Ionicons
          name={isHost ? "home-outline" : "car-outline"}
          size={14}
          color={Colors.textMuted}
        />
        <Text style={[Typography.caption, styles.roleBadgeText]}>
          Setting up as {isHost ? "Host" : "Driver"}
        </Text>
      </Animated.View>

      {/* ── CTA ── */}
      <Animated.View entering={FadeInDown.delay(220).duration(300)} style={styles.ctaWrapper}>
        {showSuccess ? (
          <PrimaryCTA label="Go to dashboard" onPress={navigateHome} />
        ) : (
          <PrimaryCTA
            label={ctaLabel}
            onPress={handleSetUp}
            loading={isLoading}
            disabled={isLoading}
          />
        )}

        {!showSuccess && (
          <Pressable onPress={navigateHome} style={styles.skipBtn} hitSlop={12}>
            <Text style={[Typography.body, styles.skipText]}>Skip for now</Text>
          </Pressable>
        )}
      </Animated.View>

      {/* ── Security note ── */}
      {!showSuccess && (
        <Animated.View entering={FadeInDown.delay(280).duration(300)} style={styles.secureRow}>
          <Ionicons name="lock-closed-outline" size={13} color={Colors.textMuted} />
          <Text style={[Typography.caption, styles.secureText]}>
            Powered by Stripe — your details are never stored on VehicleGrid servers
          </Text>
        </Animated.View>
      )}

      {/* ── Stripe credentials modal (demo only) ── */}
      <Modal
        visible={showCredentialsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCredentialsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="key-outline" size={28} color={Colors.accent} />
              <Text style={[Typography.sectionTitle, styles.modalTitle]}>
                Enter Stripe credentials
              </Text>
            </View>
            <Text style={[Typography.body, styles.modalSubtitle]}>
              Stripe is not configured in this environment. Enter your test keys to continue.
            </Text>
            <TextInput
              style={styles.credInput}
              placeholder="Publishable key (pk_test_...)"
              placeholderTextColor={Colors.textMuted}
              value={credPublishableKey}
              onChangeText={setCredPublishableKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.credInput}
              placeholder="Secret key (sk_test_...)"
              placeholderTextColor={Colors.textMuted}
              value={credSecretKey}
              onChangeText={setCredSecretKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCredentialsModal(false)}
                style={styles.modalCancel}
              >
                <Text style={[Typography.body, { color: Colors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCredentialsSubmit} style={styles.modalSubmit}>
                <Text style={[Typography.body, { color: Colors.textInverse, fontWeight: "600" }]}>
                  Save &amp; retry
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingTop: Spacing.xxxxl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    color: Colors.textSecondary,
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  benefitsCard: {
    marginBottom: Spacing.lg,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  benefitDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  benefitText: {
    flex: 1,
  },
  successCard: {
    marginBottom: Spacing.lg,
  },
  successIcon: {
    backgroundColor: Colors.success,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  roleBadgeText: {
    color: Colors.textMuted,
  },
  ctaWrapper: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipText: {
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  secureText: {
    color: Colors.textMuted,
    textAlign: "center",
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  modalTitle: {
    flex: 1,
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  credInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  modalCancel: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  modalSubmit: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
});
