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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { InputField, GradientButton } from "@/src/components";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { useAuth } from "@/src/features/auth/auth-context";
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@/src/features/auth/google-auth.config";

WebBrowser.maybeCompleteAuthSession();

const ROLE_INFO = [
  { label: "Driver", ionicon: "car-sport" as const, desc: "Find & book chargers" },
  { label: "Host", ionicon: "home" as const, desc: "List your charger" },
  { label: "Admin", ionicon: "shield-checkmark" as const, desc: "Manage the platform" },
] as const;

export default function SignInScreen() {
  const { login, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

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
          <Animated.View entering={FadeIn.duration(400)} style={styles.brandBlock}>
            <LinearGradient
              colors={[Colors.accent, Colors.accentDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoSquare}
            >
              <Ionicons name="flash" size={32} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.brandName}>VehicleGrid</Text>
            <Text style={styles.brandTagline}>The EV charging marketplace</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.roleTileRow}>
            {ROLE_INFO.map((role) => (
              <View key={role.label} style={styles.roleTile}>
                <View style={styles.roleTileIconCircle}>
                  <Ionicons name={role.ionicon} size={18} color={Colors.primaryDark} />
                </View>
                <Text style={styles.roleTileLabel}>{role.label}</Text>
                <Text style={styles.roleTileDesc}>{role.desc}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>
              Access your Driver, Host, or Admin account
            </Text>

            <TouchableOpacity
              style={[
                styles.googleBtn,
                (googleLoading || !googleRequest || isExpoGo) && styles.disabledBtn,
              ]}
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
                  ? "Signing in…"
                  : "Continue with Google"}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or continue with email</Text>
              <View style={styles.dividerLine} />
            </View>

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
              leftIcon={<Ionicons name="mail-outline" size={16} color={Colors.textMuted} />}
            />

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
              leftIcon={<Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />}
              rightIcon={
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={16} color={Colors.textMuted} />
              }
              onRightIconPress={() => setShowPassword((v) => !v)}
            />

            <GradientButton
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
          </Animated.View>

          {/* Role hint removed — role tiles communicate this */}
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
  brandBlock: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  logoSquare: {
    width: 68,
    height: 68,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    ...Shadows.button,
  },
  brandName: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    fontFamily: "Syne_800ExtraBold",
  },
  brandTagline: {
    ...Typography.body,
    marginTop: 3,
  },
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
  },
  roleTileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  roleTileLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
    fontFamily: "DMSans_700Bold",
  },
  roleTileDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 13,
    fontFamily: "DMSans_400Regular",
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
    ...Typography.sectionTitle,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...Typography.body,
    marginBottom: Spacing.xl,
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
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
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
    backgroundColor: Colors.borderLight,
  },
  dividerLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "500",
    fontFamily: "DMSans_500Medium",
  },
  ctaBtn: {
    marginTop: Spacing.sm,
  },
  footerText: {
    textAlign: "center",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
    fontFamily: "DMSans_400Regular",
  },
  footerLink: {
    color: Colors.accent,
    fontWeight: "700",
  },
  // roleHint removed
});
