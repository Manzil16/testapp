import * as Google from "expo-auth-session/providers/google";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
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
import { InputField } from "@/src/components/forms/InputField";
import { PrimaryCTA } from "@/src/components/ui/PrimaryCTA";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { useAuth } from "@/src/features/auth/auth-context";
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@/src/features/auth/google-auth.config";

// Required for expo-auth-session to close the auth browser automatically
WebBrowser.maybeCompleteAuthSession();

const ROLE_INFO = [
  { label: "Driver", icon: "🚗", desc: "Find & book chargers" },
  { label: "Host", icon: "🏠", desc: "List your charger" },
  { label: "Admin", icon: "🛡️", desc: "Manage the platform" },
] as const;

export default function SignInScreen() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // ─── Google Auth ─────────────────────────────────────────────────────────
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const idToken = googleResponse.params?.id_token;
      if (idToken) {
        handleGoogleCredential(idToken);
      }
    }
  }, [googleResponse]);

  async function handleGoogleCredential(idToken: string) {
    try {
      setGoogleLoading(true);
      await loginWithGoogle(idToken);
      router.replace("/(app)/(tabs)/dashboard" as any);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Google sign-in failed.";
      Alert.alert("Google Sign-In Failed", msg);
    } finally {
      setGoogleLoading(false);
    }
  }

  // ─── Email/Password Login ─────────────────────────────────────────────────
  function validate() {
    let valid = true;
    setEmailError("");
    setPasswordError("");

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
    }

    return valid;
  }

  async function handleLogin() {
    if (!validate()) return;

    try {
      setSubmitting(true);
      await login(email.trim(), password);
      router.replace("/(app)/(tabs)/dashboard" as any);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to sign in.";
      Alert.alert("Sign In Failed", msg);
    } finally {
      setSubmitting(false);
    }
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
          {/* ── Brand ─────────────────────────────────────────────────── */}
          <View style={styles.brandBlock}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>⚡</Text>
            </View>
            <Text style={styles.brandName}>VehicleGrid</Text>
            <Text style={styles.brandTagline}>The EV charging marketplace</Text>
          </View>

          {/* ── Role Info Tiles (informational — role is set on sign-up) ── */}
          <View style={styles.roleTileRow}>
            {ROLE_INFO.map((role) => (
              <View key={role.label} style={styles.roleTile}>
                <Text style={styles.roleTileIcon}>{role.icon}</Text>
                <Text style={styles.roleTileLabel}>{role.label}</Text>
                <Text style={styles.roleTileDesc}>{role.desc}</Text>
              </View>
            ))}
          </View>

          {/* ── Auth Card ─────────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>
              Access your Driver, Host, or Admin account
            </Text>

            {/* Google Button */}
            <TouchableOpacity
              style={[
                styles.googleBtn,
                (googleLoading || !googleRequest) && styles.disabledBtn,
              ]}
              onPress={() => googlePromptAsync()}
              disabled={googleLoading || !googleRequest}
              activeOpacity={0.8}
            >
              <View style={styles.googleG}>
                <Text style={styles.googleGText}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>
                {googleLoading ? "Signing in…" : "Continue with Google"}
              </Text>
            </TouchableOpacity>

            {/* OR Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or continue with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email */}
            <InputField
              label="Email address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setEmailError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
              error={emailError}
              leftIcon={<Text style={styles.inputIcon}>✉</Text>}
            />

            {/* Password */}
            <InputField
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setPasswordError("");
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="••••••••"
              error={passwordError}
              leftIcon={<Text style={styles.inputIcon}>🔒</Text>}
              rightIcon={
                <Text style={styles.inputIcon}>{showPassword ? "🙈" : "👁"}</Text>
              }
              onRightIconPress={() => setShowPassword((v) => !v)}
            />

            <PrimaryCTA
              label="Sign In"
              onPress={handleLogin}
              loading={submitting}
              style={styles.ctaBtn}
            />

            <Text style={styles.footerText}>
              New to VehicleGrid?{" "}
              <Link href={"/(auth)/sign-up" as any} style={styles.footerLink}>
                Create account
              </Link>
            </Text>
          </View>

          <Text style={styles.roleHint}>
            Your role (Driver / Host / Admin) is selected when you create your account
            and can be updated anytime in Settings.
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

  // Brand block
  brandBlock: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    ...Shadows.button,
  },
  logoEmoji: {
    fontSize: 34,
  },
  brandName: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    ...Typography.body,
    marginTop: 3,
  },

  // Role info tiles
  roleTileRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  roleTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  roleTileIcon: {
    fontSize: 22,
    marginBottom: 5,
  },
  roleTileLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  roleTileDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 13,
  },

  // Auth card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    ...Shadows.card,
  },
  cardTitle: {
    ...Typography.sectionTitle,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...Typography.body,
    marginBottom: Spacing.xl,
  },

  // Google
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
    ...Shadows.card,
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
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: "800",
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  // OR divider
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
    color: Colors.primary,
    fontWeight: "700",
  },

  roleHint: {
    textAlign: "center",
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: Spacing.xl,
    lineHeight: 16,
    paddingHorizontal: Spacing.sm,
  },
});
