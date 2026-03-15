import Constants from "expo-constants";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  Avatar,
  EmptyStateCard,
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
import { useAvatarUpload, useDriverDashboard, useEntranceAnimation } from "@/src/hooks";
import type { AppRole } from "@/src/features/users";

const roleOptions: AppRole[] = ["driver", "host", "admin"];

export default function ProfileScreen() {
  const { authUser, sessionUser, profile, updateProfileDetails, logout } = useAuth();
  const entranceStyle = useEntranceAnimation();

  const userId = useMemo(
    () => authUser?.uid || sessionUser?.uid,
    [authUser?.uid, sessionUser?.uid]
  );

  const { pickAndUpload, uploading, progress } = useAvatarUpload(userId);
  const { data } = useDriverDashboard(userId);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [reservePercent, setReservePercent] = useState("12");
  const [role, setRole] = useState<AppRole>("driver");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [devTapCount, setDevTapCount] = useState(0);
  const [devToggleUnlocked, setDevToggleUnlocked] = useState(false);

  const version = useMemo(
    () => Constants.expoConfig?.version || "1.0.0",
    []
  );

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "");
    setPhone(profile.phone || "");
    setRole(profile.role);
    setReservePercent(String(profile.preferredReservePercent ?? 12));
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      await updateProfileDetails({
        displayName: displayName.trim() || profile.displayName,
        phone: phone.trim(),
        preferredReservePercent:
          profile.role === "driver"
            ? Math.max(5, Math.min(40, Number(reservePercent) || 12))
            : undefined,
        role: devToggleUnlocked ? role : undefined,
      });
      Alert.alert("Saved", "Profile updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save profile.";
      Alert.alert("Update failed", message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setSigningOut(true);
      await logout();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign out.";
      Alert.alert("Sign out failed", message);
    } finally {
      setSigningOut(false);
    }
  };

  const handleVersionTap = () => {
    const next = devTapCount + 1;
    if (next >= 7) {
      setDevToggleUnlocked(true);
      setDevTapCount(0);
      Alert.alert("Developer toggle enabled", "Role switcher is now visible for this session.");
      return;
    }
    setDevTapCount(next);
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScreenContainer>
          <EmptyStateCard
            icon="👤"
            title="Profile unavailable"
            message="Sign in again to continue."
          />
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer>
          {/* Header section */}
          <Animated.View entering={FadeIn.duration(350)} style={styles.headerCard}>
            <PressableScale onPress={pickAndUpload} style={styles.avatarWrap}>
              <Avatar
                uri={profile.avatarUrl}
                name={displayName || profile.displayName}
                size="xl"
              />
              {uploading ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color={Colors.textInverse} />
                  <Text style={styles.uploadText}>{Math.round(progress * 100)}%</Text>
                </View>
              ) : (
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={14} color="#FFF" />
                </View>
              )}
            </PressableScale>
            <Text style={styles.profileName}>{displayName || profile.displayName}</Text>
            <InfoPill label={profile.role.toUpperCase()} variant="primary" />

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{data.stats.totalTrips}</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{data.stats.totalBookings}</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{data.stats.vehiclesRegistered}</Text>
                <Text style={styles.statLabel}>Vehicles</Text>
              </View>
            </View>
          </Animated.View>

          {/* Settings Form */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.formSection}>
            <Text style={styles.sectionLabel}>Account Details</Text>

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

            {profile.role === "driver" ? (
              <InputField
                label="Preferred Reserve %"
                value={reservePercent}
                onChangeText={setReservePercent}
                keyboardType="numeric"
                hint="Used in trip planner battery safety calculations"
                leftIcon={<Ionicons name="battery-half-outline" size={16} color={Colors.textMuted} />}
              />
            ) : null}

            {devToggleUnlocked ? (
              <View style={styles.devRoleWrap}>
                <Text style={styles.devLabel}>Role (Dev Toggle)</Text>
                <View style={styles.roleRow}>
                  {roleOptions.map((option) => {
                    const selected = option === role;
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[styles.roleChip, selected && styles.roleChipActive]}
                        onPress={() => setRole(option)}
                      >
                        <Text style={[styles.roleChipLabel, selected && styles.roleChipLabelActive]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <PrimaryCTA label="Save Changes" onPress={handleSave} loading={saving} />
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

          <TouchableOpacity style={styles.versionRow} onPress={handleVersionTap} activeOpacity={0.8}>
            <Text style={styles.versionText}>VehicleGrid v{version}</Text>
            {!devToggleUnlocked ? (
              <Text style={styles.versionHint}>{Math.max(0, 7 - devTapCount)} taps to dev mode</Text>
            ) : (
              <Text style={styles.versionHint}>Dev mode enabled</Text>
            )}
          </TouchableOpacity>
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
    position: "relative",
    marginBottom: Spacing.md,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.full,
    backgroundColor: Colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    ...Typography.caption,
    color: Colors.textInverse,
    marginTop: 2,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    width: "100%",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
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
  devRoleWrap: {
    marginBottom: Spacing.lg,
  },
  devLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  roleRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
  },
  roleChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  roleChipLabel: {
    ...Typography.caption,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  roleChipLabelActive: {
    color: Colors.primaryDark,
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

  // Version
  versionRow: {
    alignItems: "center",
    marginBottom: Spacing.xxxl + 20,
  },
  versionText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  versionHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
