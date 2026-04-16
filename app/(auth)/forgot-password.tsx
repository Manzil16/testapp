import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { InputField, GradientButton, SecondaryButton } from "@/src/components";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { supabase } from "@/src/lib/supabase";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function validate() {
    if (!email.trim()) {
      setEmailError("Email is required.");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  }

  async function handleSendReset() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const scheme = Constants.expoConfig?.scheme ?? "vehiclegrid";
      const appScheme = Array.isArray(scheme) ? scheme[0] : scheme;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${appScheme}://reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send reset email.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Animated.View entering={FadeIn.duration(350)} style={styles.centeredWrapper}>
          <View style={styles.successIconRing}>
            <Ionicons name="mail-outline" size={40} color={Colors.accent} />
          </View>
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successBody}>
            We've sent a password reset link to{"\n"}
            <Text style={styles.emailHighlight}>{email.trim()}</Text>
          </Text>
          <Text style={styles.successNote}>
            Check your spam folder if you don't see it within a few minutes.
          </Text>
          <View style={styles.backBtnWrap}>
            <GradientButton
              label="Back to Sign In"
              onPress={() => router.replace("/(auth)/sign-in" as any)}
            />
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
            <View style={styles.iconRing}>
              <Ionicons name="lock-open-outline" size={36} color={Colors.accent} />
            </View>
            <Text style={styles.heading}>Forgot Password?</Text>
            <Text style={styles.subheading}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.card}>
            <InputField
              label="Email address"
              value={email}
              onChangeText={(t) => { setEmail(t); setEmailError(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
              error={emailError}
              leftIcon={<Ionicons name="mail-outline" size={16} color={Colors.textMuted} />}
            />

            <GradientButton
              label="Send Reset Link"
              onPress={handleSendReset}
              loading={submitting}
              disabled={!email.trim()}
              style={styles.ctaBtn}
            />

            <SecondaryButton
              label="Back to Sign In"
              onPress={() => router.back()}
              style={styles.backBtn}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.xxxxl,
    paddingBottom: 48,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  heading: {
    ...Typography.pageTitle,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subheading: {
    ...Typography.body,
    textAlign: "center",
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
    gap: Spacing.md,
  },
  ctaBtn: {
    marginTop: Spacing.xs,
  },
  backBtn: {
    backgroundColor: Colors.surfaceAlt,
  },

  // Success state
  centeredWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  successIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    ...Typography.pageTitle,
    textAlign: "center",
  },
  successBody: {
    ...Typography.body,
    textAlign: "center",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  emailHighlight: {
    color: Colors.accent,
    fontFamily: "DMSans_600SemiBold",
  },
  successNote: {
    ...Typography.caption,
    textAlign: "center",
    color: Colors.textMuted,
  },
  backBtnWrap: {
    width: "100%",
    marginTop: Spacing.sm,
  },
});
