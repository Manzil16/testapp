import { useEffect, useState } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { InputField, GradientButton, SecondaryButton } from "@/src/components";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { supabase } from "@/src/lib/supabase";

interface PasswordReqs {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  digit: boolean;
}

function checkPasswordReqs(pw: string): PasswordReqs {
  return {
    length: pw.length >= 12,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
  };
}

function PasswordRequirements({ reqs, visible }: { reqs: PasswordReqs; visible: boolean }) {
  if (!visible) return null;
  const items: { key: keyof PasswordReqs; label: string }[] = [
    { key: "length", label: "At least 12 characters" },
    { key: "uppercase", label: "One uppercase letter (A–Z)" },
    { key: "lowercase", label: "One lowercase letter (a–z)" },
    { key: "digit", label: "One number (0–9)" },
  ];
  return (
    <View style={reqStyles.container}>
      {items.map(({ key, label }) => (
        <View key={key} style={reqStyles.row}>
          <Ionicons
            name={reqs[key] ? "checkmark-circle" : "ellipse-outline"}
            size={14}
            color={reqs[key] ? Colors.success : Colors.textMuted}
          />
          <Text style={[reqStyles.text, reqs[key] && reqStyles.textMet]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const reqStyles = StyleSheet.create({
  container: { marginTop: 6, marginBottom: 4, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { fontSize: 12, color: Colors.textMuted },
  textMet: { color: Colors.success },
});

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState("");

  // Exchange the one-time code from the deep link for a valid session.
  // Without this the updateUser call below will fail or update the wrong user.
  useEffect(() => {
    const code = params.code;
    if (!code) {
      setSessionError("Invalid or expired reset link. Please request a new one.");
      return;
    }
    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setSessionError("This reset link has expired. Please request a new one.");
      } else {
        setSessionReady(true);
      }
    })();
  }, [params.code]);

  const reqs = checkPasswordReqs(newPassword);
  const passwordStrong = Object.values(reqs).every(Boolean);

  function validate() {
    let valid = true;
    setNewPasswordError("");
    setConfirmPasswordError("");

    if (!newPassword) {
      setNewPasswordError("Password is required.");
      valid = false;
    } else if (!passwordStrong) {
      setNewPasswordError("Password does not meet all requirements below.");
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password.");
      valid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    }

    return valid;
  }

  async function handleReset() {
    if (!sessionReady || !validate()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert(
        "Password Reset",
        "Your password has been updated successfully.",
        [{ text: "Sign In", onPress: () => router.replace("/(auth)/sign-in" as any) }]
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reset password.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionError) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Animated.View entering={FadeIn.duration(350)} style={styles.errorWrapper}>
          <View style={styles.iconRing}>
            <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
          </View>
          <Text style={[styles.heading, { color: Colors.error }]}>Link Expired</Text>
          <Text style={[styles.subheading, { marginBottom: Spacing.xl }]}>{sessionError}</Text>
          <SecondaryButton
            label="Request New Link"
            onPress={() => router.replace("/(auth)/forgot-password" as any)}
          />
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
              <Ionicons name="lock-closed-outline" size={36} color={Colors.accent} />
            </View>
            <Text style={styles.heading}>Reset Password</Text>
            <Text style={styles.subheading}>
              Choose a strong password for your account.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.card}>
            <InputField
              label="New Password"
              value={newPassword}
              onChangeText={(t) => { setNewPassword(t); setNewPasswordError(""); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="Minimum 12 characters"
              error={newPasswordError}
              leftIcon={<Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />}
              rightIcon={
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={16}
                  color={Colors.textMuted}
                />
              }
              onRightIconPress={() => setShowPassword((v) => !v)}
            />
            <PasswordRequirements reqs={reqs} visible={newPassword.length > 0} />

            <InputField
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setConfirmPasswordError(""); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="Re-enter password"
              error={confirmPasswordError}
              leftIcon={<Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />}
            />

            <GradientButton
              label={sessionReady ? "Reset Password" : "Verifying link…"}
              onPress={handleReset}
              loading={submitting || !sessionReady}
              disabled={submitting || !sessionReady || !newPassword || !confirmPassword}
              style={styles.ctaBtn}
            />
            <SecondaryButton
              label="Back to Sign In"
              onPress={() => router.replace("/(auth)/sign-in" as any)}
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
  errorWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
});
