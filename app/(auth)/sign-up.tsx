import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { InputField, GradientButton } from "@/src/components";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { useAuth } from "@/src/features/auth/auth-context";
import type { AppRole } from "@/src/features/users/user.types";
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  validateGoogleAuthConfig,
} from "@/src/features/auth/google-auth.config";

WebBrowser.maybeCompleteAuthSession();

// ─── Password requirements ────────────────────────────────────────────────────
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
  container: {
    marginTop: 6,
    marginBottom: 4,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  textMet: {
    color: Colors.success,
  },
});

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
    icon: "car-sport",
    headline: "Find & book EV chargers",
    bullets: ["Discover nearby chargers", "Book sessions in advance", "Track trips & energy use"],
    accentColor: Colors.accent,
    accentBg: Colors.accentLight,
  },
  {
    id: "host",
    label: "Host",
    icon: "home",
    headline: "List your charger & earn",
    bullets: ["Share your home charger", "Set your own schedule", "Earn per kWh delivered"],
    accentColor: Colors.info,
    accentBg: Colors.infoLight,
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

  const passwordReqs = useMemo(() => checkPasswordReqs(password), [password]);
  const passwordStrong = Object.values(passwordReqs).every(Boolean);

  const isExpoGo = Constants.appOwnership === "expo";

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    try {
      setGoogleLoading(true);
      validateGoogleAuthConfig();
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
    } else if (!passwordStrong) {
      setPasswordError("Password does not meet all requirements below.");
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

                    <View style={[styles.roleCardIconCircle, { backgroundColor: isActive ? r.accentColor + "22" : Colors.surfaceAlt }]}>
                      <Ionicons name={r.icon as any} size={22} color={isActive ? r.accentColor : Colors.textMuted} />
                    </View>
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
              <View style={styles.roleBannerContent}>
                <Ionicons name={selectedRole.icon as any} size={16} color={selectedRole.accentColor} />
                <Text style={[styles.roleBannerText, { color: selectedRole.accentColor }]}>
                  Signing up as a <Text style={{ fontWeight: "800" }}>{selectedRole.label}</Text> — {selectedRole.headline.toLowerCase()}
                </Text>
              </View>
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
              leftIcon={<Ionicons name="person-outline" size={16} color={Colors.textMuted} />}
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
              leftIcon={<Ionicons name="mail-outline" size={16} color={Colors.textMuted} />}
            />

            <InputField
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setPasswordError(""); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="Minimum 12 characters"
              error={passwordError}
              leftIcon={<Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />}
              rightIcon={
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={16} color={Colors.textMuted} />
              }
              onRightIconPress={() => setShowPassword((v) => !v)}
            />
            <PasswordRequirements reqs={passwordReqs} visible={password.length > 0} />

            <InputField
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setConfirmError(""); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="Re-enter password"
              error={confirmError}
              leftIcon={<Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />}
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
    ...Typography.label,
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
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
  roleCardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
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
  roleBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  roleBannerText: {
    ...Typography.label,
    textAlign: "center",
    lineHeight: 18,
    flex: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
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
    ...Typography.body,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
    flexShrink: 1,
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
    backgroundColor: Colors.borderLight,
  },
  dividerLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "500" as const,
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
