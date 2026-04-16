import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, ToastAndroid, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  Avatar,
  InfoPill,
  InputField,
  PrimaryCTA,
  PressableScale,
  ScreenContainer,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { useThemeColors } from "@/src/hooks/useThemeColors";
import { useAvatarUpload, useEntranceAnimation } from "@/src/hooks";

export default function AdminSettingsTabScreen() {
  const router = useRouter();
  const { user, profile, updateProfileDetails, logout } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const colors = useThemeColors();

  const userId = useMemo(() => user?.id, [user?.id]);
  const { pickAndUpload, uploading, progress } = useAvatarUpload(userId);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [incidentThreshold, setIncidentThreshold] = useState("3");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const adminName = useMemo(
    () => displayName || profile?.displayName || "Admin",
    [displayName, profile?.displayName]
  );

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "");
    setPhone(profile.phone || "");
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      await updateProfileDetails({
        displayName: displayName.trim() || profile.displayName,
        phone: phone.trim(),
      });
      Alert.alert("Saved", "Admin settings updated.");
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setSigningOut(true);
      await logout();
      router.replace("/(auth)/sign-in" as any);
    } catch {
      const message = "Sign out failed, please try again";
      if (Platform.OS === "android") {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setSigningOut(false);
    }
  };

  if (!profile?.isAdmin) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer>
          {/* Header card */}
          <Animated.View entering={FadeIn.duration(350)} style={[styles.headerCard, { backgroundColor: colors.surface }]}>
            <PressableScale style={styles.avatarWrap} onPress={pickAndUpload}>
              <Avatar
                uri={profile?.avatarUrl}
                name={adminName}
                size="xl"
              />
              {uploading ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.uploadText}>{Math.round(progress * 100)}%</Text>
                </View>
              ) : (
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={14} color={Colors.textInverse} />
                </View>
              )}
            </PressableScale>
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>{adminName}</Text>
            <InfoPill label="ADMIN" variant="primary" />
            <Text style={[styles.emailText, { color: colors.textMuted }]}>{profile?.email || "No email"}</Text>
          </Animated.View>

          {/* Settings Form */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={[styles.formSection, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Account Details</Text>

            <InputField
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              leftIcon={<Ionicons name="person-outline" size={16} color={Colors.textMuted} />}
            />
            <InputField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+61 ..."
              leftIcon={<Ionicons name="call-outline" size={16} color={Colors.textMuted} />}
            />
            <InputField
              label="Auto-escalation Threshold"
              value={incidentThreshold}
              onChangeText={setIncidentThreshold}
              keyboardType="numeric"
              hint="Flag charger after this many trust incidents"
              leftIcon={<Ionicons name="warning-outline" size={16} color={Colors.textMuted} />}
            />

            <PrimaryCTA label="Save Settings" onPress={handleSave} loading={saving} />
          </Animated.View>

          {/* Sign Out */}
          <Animated.View entering={FadeInDown.delay(200).duration(350)}>
            <PressableScale style={styles.logoutBtn} onPress={handleLogout}>
              {signingOut ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color={Colors.error} />
                  <Text style={styles.logoutText}>Sign Out</Text>
                </>
              )}
            </PressableScale>
          </Animated.View>
        </ScreenContainer>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header card
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  avatarWrap: {
    marginBottom: Spacing.md,
    position: "relative",
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    ...Typography.caption,
    color: "#FFFFFF",
    marginTop: 2,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.3)",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emailText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },

  // Form
  formSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.error,
  },
});
