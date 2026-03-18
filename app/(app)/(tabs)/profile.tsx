import Constants from "expo-constants";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  Avatar,
  EmptyStateCard,
  GradientButton,
  InfoPill,
  InputField,
  PremiumCard,
  PressableScale,
  ScreenContainer,
  SectionTitle,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useThemeColors } from "@/src/hooks/useThemeColors";
import { useAuth } from "@/src/features/auth/auth-context";
import { useAvatarUpload, useBadgeCounts, useDriverDashboard, useEntranceAnimation, useSettings } from "@/src/hooks";
import { useAchievements } from "@/src/hooks/useAchievements";
import { AppConfig } from "@/src/constants/app";
import type { AppRole } from "@/src/features/users";
import type { CurrencyCode } from "@/src/hooks/useSettings";

const roleOptions: AppRole[] = ["driver", "host", "admin"];
const CURRENCY_OPTIONS: CurrencyCode[] = ["AUD", "USD", "EUR", "GBP", "NZD"];

// Achievements are now computed from real DB data via useAchievements hook

export default function ProfileScreen() {
  const { focusField } = useLocalSearchParams<{ focusField?: string }>();
  const { user, profile, updateProfileDetails } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const settings = useSettings();
  const { markProfileSeen } = useBadgeCounts();
  const colors = useThemeColors();

  const userId = useMemo(() => user?.id, [user?.id]);

  const { pickAndUpload, uploading, progress } = useAvatarUpload(userId);
  const { data } = useDriverDashboard(userId);
  const { achievements } = useAchievements(userId);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [reservePercent, setReservePercent] = useState(String(AppConfig.VEHICLE_DEFAULTS.reservePercent));
  const [role, setRole] = useState<AppRole>("driver");
  const [saving, setSaving] = useState(false);

  const [devTapCount, setDevTapCount] = useState(0);
  const [devToggleUnlocked, setDevToggleUnlocked] = useState(false);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Currency picker
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const phoneInputRef = useRef<TextInput>(null);

  const version = useMemo(() => Constants.expoConfig?.version || "1.0.0", []);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "");
    setPhone(profile.phone || "");
    setRole(profile.role);
    setReservePercent(String(profile.preferredReservePercent ?? AppConfig.VEHICLE_DEFAULTS.reservePercent));
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void markProfileSeen();

      if (focusField === "phone") {
        const timer = setTimeout(() => {
          phoneInputRef.current?.focus();
        }, 250);
        return () => clearTimeout(timer);
      }

      return undefined;
    }, [focusField, markProfileSeen])
  );

  const handleSave = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      await updateProfileDetails({
        displayName: displayName.trim() || profile.displayName,
        phone: phone.trim(),
        preferredReservePercent:
          profile.role === "driver"
            ? Math.max(AppConfig.VEHICLE_DEFAULTS.bounds.minReservePercent, Math.min(AppConfig.VEHICLE_DEFAULTS.bounds.maxReservePercent, Number(reservePercent) || AppConfig.VEHICLE_DEFAULTS.reservePercent))
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

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => settings.signOut(),
      },
    ]);
  };

  const handleDeleteAccount = () => {
    setDeleteConfirmText("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (deleteConfirmText !== "DELETE") {
      Alert.alert("Confirmation Required", 'Please type "DELETE" to confirm.');
      return;
    }
    setShowDeleteModal(false);
    await settings.deleteAccount();
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert("Invalid Password", "Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }
    await settings.changePassword(newPassword);
    setShowPasswordModal(false);
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const handleVersionTap = () => {
    const next = devTapCount + 1;
    if (next >= AppConfig.DEV_TAP_COUNT) {
      setDevToggleUnlocked(true);
      setDevTapCount(0);
      Alert.alert("Developer toggle enabled", "Role switcher is now visible for this session.");
      return;
    }
    setDevTapCount(next);
  };

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
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
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer>
          {/* Header with gradient */}
          <Animated.View entering={FadeIn.duration(350)}>
            <LinearGradient
              colors={Colors.gradientHero as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <PressableScale onPress={pickAndUpload} style={styles.avatarWrap}>
                <Avatar
                  uri={profile.avatarUrl}
                  name={displayName || profile.displayName}
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
            </LinearGradient>
          </Animated.View>

          {/* Achievements */}
          <Animated.View entering={FadeInDown.delay(80).duration(350)}>
            <SectionTitle title="Achievements" subtitle="Milestones on your journey" />
            <View style={styles.achievementsRow}>
              {achievements.map((a) => (
                <View key={a.id} style={[styles.achievementCard, !a.earned && styles.achievementLocked]}>
                  <Text style={styles.achievementIcon}>{a.icon}</Text>
                  <Text style={styles.achievementLabel}>{a.label}</Text>
                  {a.progress ? (
                    <Text style={styles.achievementProgress}>{a.progress}</Text>
                  ) : a.earned ? (
                    <Text style={styles.achievementEarned}>Earned</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Account Details */}
          <Animated.View entering={FadeInDown.delay(150).duration(350)}>
            <PremiumCard style={styles.formSection}>
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
                inputRef={phoneInputRef}
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

              <GradientButton label="Save Changes" onPress={handleSave} loading={saving} />
            </PremiumCard>
          </Animated.View>

          {/* Settings */}
          <Animated.View entering={FadeInDown.delay(220).duration(350)}>
            <PremiumCard style={styles.settingsSection}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Settings</Text>

              {/* Push Notifications */}
              <PressableScale onPress={settings.toggleNotifications} style={styles.settingsRow}>
                <Ionicons name="notifications-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.settingsLabel}>Push Notifications</Text>
                {settings.loadingNotifications ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.settingsTrailing}>
                    {settings.notificationsEnabled ? "On" : "Off"}
                  </Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </PressableScale>

              {/* Currency */}
              <PressableScale
                onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
                style={styles.settingsRow}
              >
                <Ionicons name="cash-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.settingsLabel}>Currency</Text>
                <Text style={styles.settingsTrailing}>{settings.currency}</Text>
                <Ionicons
                  name={showCurrencyPicker ? "chevron-down" : "chevron-forward"}
                  size={16}
                  color={Colors.textMuted}
                />
              </PressableScale>

              {showCurrencyPicker && (
                <View style={styles.currencyRow}>
                  {CURRENCY_OPTIONS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.currencyChip,
                        c === settings.currency && styles.currencyChipActive,
                      ]}
                      onPress={() => {
                        settings.setCurrency(c);
                        setShowCurrencyPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.currencyChipLabel,
                          c === settings.currency && styles.currencyChipLabelActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Change Password */}
              <PressableScale
                onPress={() => {
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setShowPasswordModal(!showPasswordModal);
                }}
                style={styles.settingsRow}
              >
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.settingsLabel}>Change Password</Text>
                <Ionicons
                  name={showPasswordModal ? "chevron-down" : "chevron-forward"}
                  size={16}
                  color={Colors.textMuted}
                />
              </PressableScale>

              {showPasswordModal && (
                <View style={styles.inlineForm}>
                  <TextInput
                    style={styles.inlineInput}
                    placeholder="New password"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.inlineInput}
                    placeholder="Confirm new password"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    autoCapitalize="none"
                  />
                  <GradientButton
                    label="Update Password"
                    onPress={handleChangePassword}
                    loading={settings.loadingPassword}
                  />
                </View>
              )}
            </PremiumCard>
          </Animated.View>

          {/* Account Actions */}
          <Animated.View entering={FadeInDown.delay(300).duration(350)}>
            <PressableScale style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={Colors.error} />
              <Text style={styles.logoutText}>Sign Out</Text>
            </PressableScale>

            <PressableScale style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.deleteText}>Delete Account</Text>
            </PressableScale>

            {/* Delete confirmation inline */}
            {showDeleteModal && (
              <PremiumCard style={styles.deleteConfirmCard}>
                <Text style={styles.deleteConfirmTitle}>Confirm Account Deletion</Text>
                <Text style={styles.deleteConfirmBody}>
                  This action is permanent. All your data, photos, and account will be removed.
                  Type DELETE below to confirm.
                </Text>
                <TextInput
                  style={styles.inlineInput}
                  placeholder='Type "DELETE" to confirm'
                  placeholderTextColor={Colors.textMuted}
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  autoCapitalize="characters"
                />
                <View style={styles.deleteConfirmActions}>
                  <TouchableOpacity
                    style={styles.deleteConfirmCancel}
                    onPress={() => setShowDeleteModal(false)}
                  >
                    <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.deleteConfirmBtn,
                      deleteConfirmText !== "DELETE" && styles.deleteConfirmBtnDisabled,
                    ]}
                    onPress={confirmDelete}
                    disabled={settings.loadingDelete}
                  >
                    {settings.loadingDelete ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.deleteConfirmBtnText}>Delete My Account</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </PremiumCard>
            )}
          </Animated.View>

          <TouchableOpacity style={styles.versionRow} onPress={handleVersionTap} activeOpacity={0.8}>
            <Text style={styles.versionText}>VehicleGrid v{version}</Text>
            {!devToggleUnlocked ? (
              <Text style={styles.versionHint}>{Math.max(0, AppConfig.DEV_TAP_COUNT - devTapCount)} taps to dev mode</Text>
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

  // Header gradient
  headerGradient: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
    ...Shadows.glow,
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
    color: Colors.textInverse,
    marginBottom: Spacing.xs,
    fontFamily: "Syne_700Bold",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.2)",
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
    color: "#FFFFFF",
    fontFamily: "Syne_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  // Achievements
  achievementsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  achievementCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  achievementIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  achievementLocked: {
    opacity: 0.45,
  },
  achievementLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
    fontFamily: "DMSans_600SemiBold",
  },
  achievementProgress: {
    fontSize: 9,
    fontWeight: "500",
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 2,
    fontFamily: "DMSans_500Medium",
  },
  achievementEarned: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.accent,
    textAlign: "center",
    marginTop: 2,
    fontFamily: "DMSans_600SemiBold",
  },

  // Form
  formSection: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    fontFamily: "Syne_700Bold",
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
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  roleChipLabel: {
    ...Typography.caption,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  roleChipLabelActive: {
    color: Colors.accent,
  },

  // Settings
  settingsSection: {
    marginBottom: Spacing.lg,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.textPrimary,
    fontFamily: "DMSans_500Medium",
  },
  settingsTrailing: {
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: "DMSans_400Regular",
  },

  // Currency picker
  currencyRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    flexWrap: "wrap",
  },
  currencyChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  currencyChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  currencyChipLabel: {
    ...Typography.caption,
    fontWeight: "600",
  },
  currencyChipLabelActive: {
    color: Colors.accent,
  },

  // Inline form (password)
  inlineForm: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  inlineInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
  },

  // Account Actions
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.error,
    fontFamily: "DMSans_600SemiBold",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textMuted,
    fontFamily: "DMSans_500Medium",
  },

  // Delete confirmation
  deleteConfirmCard: {
    marginBottom: Spacing.lg,
  },
  deleteConfirmTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.error,
    marginBottom: Spacing.sm,
    fontFamily: "Syne_700Bold",
  },
  deleteConfirmBody: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  deleteConfirmActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  deleteConfirmCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  deleteConfirmCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
    fontFamily: "DMSans_600SemiBold",
  },
  deleteConfirmBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.error,
  },
  deleteConfirmBtnDisabled: {
    opacity: 0.4,
  },
  deleteConfirmBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "DMSans_600SemiBold",
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
