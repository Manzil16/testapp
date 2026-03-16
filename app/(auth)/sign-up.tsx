import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { InputField, GradientButton } from "@/src/components";
import { Colors, Radius, Spacing, Typography } from "@/src/features/shared/theme";
import { useAuth } from "@/src/features/auth/auth-context";
import type { AppRole } from "@/src/features/users/user.types";
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@/src/features/auth/google-auth.config";

WebBrowser.maybeCompleteAuthSession();

interface RoleOption {
  id: AppRole;
  label: string;
  icon: string;
  headline: string;
  bullets: string[];
  accentColor: string;
  accentBg: string;
}

const ROLES: RoleOption[] = [
  {
    id: "driver",
    label: "Driver",
    icon: "🚗",
    headline: "Find & book EV chargers",
    bullets: ["Discover nearby chargers", "Book sessions in advance", "Track trips & energy use"],
    accentColor: Colors.accent,
    accentBg: Colors.accentLight,
  },
  {
    id: "host",
    label: "Host",
    icon: "🏠",
    headline: "List your charger & earn",
    bullets: ["Share your home charger", "Set your own schedule", "Earn per kWh delivered"],
    accentColor: Colors.info,
    accentBg: Colors.infoLight,
  },
  {
    id: "admin",
    label: "Admin",
    icon: "🛡️",
    headline: "Manage the platform",
    bullets: ["Verify charger listings", "Resolve disputes & reports", "Access platform analytics"],
    accentColor: Colors.warning,
    accentBg: Colors.warningLight,
  },
];

export default function SignUpScreen() {
  const { signup, loginWithGoogle } = useAuth();

  const [role, setRole] = useState<AppRole>("driver");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const isExpoGo = Constants.appOwnership === "expo";

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    try {
      setGoogleLoading(true);
      await loginWithGoogle(idToken);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Google sign-in failed.";
      Alert.alert("Google Sign-In Failed", msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [loginWithGoogle]);

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const idToken = googleResponse.params?.id_token;
      if (idToken) {
        handleGoogleCredential(idToken);
      }
    }
  }, [googleResponse, handleGoogleCredential]);

  function validate() {
    let valid = true;
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmError("");

    if (!displayName.trim()) {
      setNameError("Full name is required.");
      valid = false;
    }

    if (!email.trim()) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmError("Please confirm your password.");
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      valid = false;
    }

    return valid;
  }

  async function handleSignup() {
    if (!validate()) return;

    try {
      setSubmitting(true);
      await signup({ email: email.trim(), password, displayName: displayName.trim(), role });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to create account.";
      Alert.alert("Sign Up Failed", msg);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRole = ROLES.find((r) => r.id === role)!;

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
            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subheading}>Choose your role to get started</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.section}>
            <Text style={styles.sectionLabel}>I am a…</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((r) => {
                const isActive = role === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setRole(r.id)}
                    activeOpacity={0.75}
                    style={[
                      styles.roleCard,
                      isActive && { borderColor: r.accentColor, backgroundColor: r.accentBg },
                    ]}
                  >
                    {isActive && (
                      <View style={[styles.roleCheck, { backgroundColor: r.accentColor }]}>
                        <Text style={styles.roleCheckMark}>✓</Text>
                      </View>
                    )}

                    <Text style={styles.roleCardIcon}>{r.icon}</Text>
                    <Text
                      style={[styles.roleCardLabel, isActive && { color: r.accentColor }]}
                    >
                      {r.label}
                    </Text>
                    <Text style={styles.roleCardHeadline}>{r.headline}</Text>

                    {r.bullets.map((bullet) => (
                      <View key={bullet} style={styles.bulletRow}>
                        <Text style={[styles.bulletDot, isActive && { color: r.accentColor }]}>•</Text>
                        <Text style={styles.bulletText}>{bullet}</Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.roleBanner, { backgroundColor: selectedRole.accentBg, borderColor: selectedRole.accentColor }]}>
              <Text style={[styles.roleBannerText, { color: selectedRole.accentColor }]}>
                {selectedRole.icon} Signing up as a <Text style={{ fontWeight: "800" }}>{selectedRole.label}</Text> — {selectedRole.headline.toLowerCase()}
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.card}>
            <Text style={styles.cardTitle}>Account Details</Text>

            <TouchableOpacity
              style={[styles.googleBtn, (googleLoading || !googleRequest || isExpoGo) && styles.disabledBtn]}
              onPress={() => googlePromptAsync()}
              disabled={googleLoading || !googleRequest || isExpoGo}
              activeOpacity={0.8}
            >
              <View style={styles.googleG}>
                <Text style={styles.googleGText}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>
                {isExpoGo
                  ? "Google sign-in unavailable in Expo Go"
                  : googleLoading
                  ? "Creating account…"
                  : `Sign up as ${selectedRole.label} with Google`}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or use email</Text>
              <View style={styles.dividerLine} />
            </View>

            <InputField
              label="Full Name"
              value={displayName}
              onChangeText={(t) => { setDisplayName(t); setNameError(""); }}
              placeholder="Your name"
              autoCapitalize="words"
              error={nameError}
              leftIcon={<Text style={styles.inputIcon}>👤</Text>}
            />

            <InputField
              label="Email address"
              value={email}
              onChangeText={(t) => { setEmail(t); setEmailError(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
              error={emailError}
              leftIcon={<Text style={styles.inputIcon}>✉</Text>}
            />

            <InputField
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setPasswordError(""); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="Minimum 6 characters"
              error={passwordError}
              leftIcon={<Text style={styles.inputIcon}>🔒</Text>}
              rightIcon={
                <Text style={styles.inputIcon}>{showPassword ? "🙈" : "👁"}</Text>
              }
              onRightIconPress={() => setShowPassword((v) => !v)}
              hint={!passwordError ? "Must be at least 6 characters" : undefined}
            />

            <InputField
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setConfirmError(""); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="Re-enter password"
              error={confirmError}
              leftIcon={<Text style={styles.inputIcon}>🔒</Text>}
            />

            <GradientButton
              label={`Create ${selectedRole.label} Account`}
              onPress={handleSignup}
              loading={submitting}
              style={styles.ctaBtn}
            />

            <Text style={styles.footerText}>
              Already have an account?{" "}
              <Link href={"/(auth)/sign-in" as any} style={styles.footerLink}>
                Sign in
              </Link>
            </Text>
          </Animated.View>

          <Text style={styles.termsText}>
            By creating an account, you agree to the VehicleGrid Terms of Service and Privacy Policy.
          </Text>
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
    paddingTop: Spacing.xxl,
    paddingBottom: 48,
  },
  header: {
    marginBottom: Spacing.xxl,
  },
  heading: {
    ...Typography.pageTitle,
    marginBottom: 4,
  },
  subheading: {
    ...Typography.body,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontFamily: "DMSans_700Bold",
  },
  roleGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  roleCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
    position: "relative",
  },
  roleCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  roleCheckMark: {
    color: Colors.textInverse,
    fontSize: 11,
    fontWeight: "800",
  },
  roleCardIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  roleCardLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 2,
    fontFamily: "Syne_800ExtraBold",
  },
  roleCardHeadline: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 13,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
    gap: 4,
  },
  bulletDot: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 14,
  },
  bulletText: {
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 14,
    flex: 1,
  },
  roleBanner: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  roleBannerText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    fontFamily: "DMSans_500Medium",
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  cardTitle: {
    ...Typography.cardTitle,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    gap: Spacing.md,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  googleG: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleGText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    flexShrink: 1,
    fontFamily: "DMSans_600SemiBold",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xl,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  inputIcon: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  ctaBtn: {
    marginTop: Spacing.sm,
  },
  footerText: {
    textAlign: "center",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
  },
  footerLink: {
    color: Colors.accent,
    fontWeight: "700",
  },
  termsText: {
    textAlign: "center",
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: Spacing.xl,
    lineHeight: 15,
    paddingHorizontal: Spacing.md,
  },
});
