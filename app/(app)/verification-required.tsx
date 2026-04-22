import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  ScreenContainer,
  PrimaryCTA,
  PremiumCard,
  SectionTitle,
  Typography,
  Colors,
  Spacing,
  Radius,
  Shadows,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { getVerificationGate } from "@/src/features/verification/verification-gates.repository";
import type { VerificationGate } from "@/src/features/verification/verification-gates.types";

interface CheckItem {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
}

export default function VerificationRequiredScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ role?: string }>();
  const role = params.role || profile?.role || "driver";

  const [gate, setGate] = useState<VerificationGate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    getVerificationGate(profile.id)
      .then(setGate)
      .finally(() => setLoading(false));
  }, [profile?.id]);

  const driverChecks: CheckItem[] = [
    {
      key: "email",
      label: "Email verified",
      description: "Confirm your email address",
      completed: gate?.emailVerified ?? false,
      icon: "mail",
      route: "/(app)/(tabs)/settings",
    },
    {
      key: "phone",
      label: "Phone verified",
      description: "Add and verify your phone number",
      completed: gate?.phoneVerified ?? false,
      icon: "call",
      route: "/(app)/(tabs)/settings",
    },
    {
      key: "payment",
      label: "Payment method added",
      description: "Add a credit or debit card",
      completed: gate?.paymentMethodAdded ?? false,
      icon: "card",
      route: "/(app)/(tabs)/settings",
    },
  ];

  const hostChecks: CheckItem[] = [
    {
      key: "email",
      label: "Email verified",
      description: "Confirm your email address",
      completed: gate?.emailVerified ?? false,
      icon: "mail",
      route: "/(app)/(tabs)/settings",
    },
    {
      key: "phone",
      label: "Phone verified",
      description: "Add and verify your phone number",
      completed: gate?.phoneVerified ?? false,
      icon: "call",
      route: "/(app)/(tabs)/settings",
    },
    {
      key: "id",
      label: "ID verified",
      description: "Upload a valid photo ID for verification",
      completed: gate?.idVerified ?? false,
      icon: "id-card",
      route: "/(app)/(tabs)/settings",
    },
    {
      key: "stripe",
      label: "Stripe onboarded",
      description: "Complete bank and tax setup to receive payouts",
      completed: gate?.stripeOnboarded ?? false,
      icon: "wallet",
      route: "/(app)/(tabs)/settings",
    },
  ];

  const checks = role === "host" ? hostChecks : driverChecks;
  const completedCount = checks.filter((c) => c.completed).length;
  const allCleared = completedCount === checks.length;

  const handleNavigate = useCallback(
    (route?: string) => {
      if (route) router.push(route as any);
    },
    [router]
  );

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <Text style={Typography.body}>Loading verification status...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{ title: allCleared ? "You're verified" : "Complete verification" }}
      />
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons
            name={allCleared ? "checkmark-circle" : "shield-half"}
            size={48}
            color={allCleared ? Colors.success : Colors.warning}
          />
        </View>
        <Text style={[Typography.body, styles.subtitle]}>
          {allCleared
            ? "All requirements met. You can now proceed."
            : `Complete ${checks.length - completedCount} more step${checks.length - completedCount > 1 ? "s" : ""} to continue.`}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(completedCount / checks.length) * 100}%` },
          ]}
        />
      </View>
      <Text style={[Typography.caption, styles.progressText]}>
        {completedCount}/{checks.length} completed
      </Text>

      {checks.map((item, idx) => (
        <Animated.View
          key={item.key}
          entering={FadeInDown.delay(idx * 60).duration(260)}
        >
          <Pressable
            onPress={() => !item.completed && handleNavigate(item.route)}
            disabled={item.completed}
          >
            <PremiumCard style={styles.checkCard}>
              <View style={styles.checkRow}>
                <View
                  style={[
                    styles.checkIcon,
                    item.completed ? styles.checkIconDone : styles.checkIconPending,
                  ]}
                >
                  <Ionicons
                    name={item.completed ? "checkmark" : item.icon}
                    size={20}
                    color={item.completed ? Colors.textInverse : Colors.warning}
                  />
                </View>
                <View style={styles.checkContent}>
                  <Text
                    style={[
                      Typography.cardTitle,
                      item.completed && styles.completedText,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={Typography.caption}>{item.description}</Text>
                </View>
                {!item.completed && (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textMuted}
                  />
                )}
              </View>
            </PremiumCard>
          </Pressable>
        </Animated.View>
      ))}

      {allCleared && (
        <View style={styles.doneBtn}>
          <PrimaryCTA label="Continue" onPress={() => router.back()} />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.xxxxl,
  },
  header: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  iconCircle: {
    marginBottom: Spacing.lg,
  },
  subtitle: {
    textAlign: "center",
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.pill,
    marginBottom: Spacing.xs,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
  },
  progressText: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  checkCard: {
    marginBottom: Spacing.sm,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  checkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  checkIconDone: {
    backgroundColor: Colors.accent,
  },
  checkIconPending: {
    backgroundColor: Colors.warningLight,
  },
  checkContent: {
    flex: 1,
    gap: 2,
  },
  completedText: {
    color: Colors.textMuted,
  },
  doneBtn: {
    marginTop: Spacing.xl,
  },
});
