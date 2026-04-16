import { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryCTA, Colors, Radius, Shadows, Spacing, Typography } from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import type { AppRole } from "@/src/features/users/user.types";

interface RoleOption {
  id: AppRole;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
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

export default function SelectRoleScreen() {
  const router = useRouter();
  const { createProfile, logout } = useAuth();

  const [selectedRole, setSelectedRole] = useState<AppRole>("driver");
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    try {
      setSubmitting(true);
      await createProfile(selectedRole);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create profile.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      await logout();
      router.replace("/(auth)/sign-in" as any);
    } catch {
      const message = "Sign out failed, please try again";
      if (Platform.OS === "android") {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } else {
        Alert.alert("Error", message);
      }
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="flash" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Welcome to VehicleGrid</Text>
          <Text style={styles.subtitle}>How will you use the platform?</Text>
        </View>

        <View style={styles.roleList}>
          {ROLES.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.roleCard,
                  isSelected && { borderColor: role.accentColor, borderWidth: 2 },
                ]}
                onPress={() => setSelectedRole(role.id)}
                activeOpacity={0.8}
              >
                <View style={styles.roleCardHeader}>
                  <View style={[styles.roleIconCircle, { backgroundColor: role.accentBg }]}>
                    <Ionicons name={role.icon} size={22} color={role.accentColor} />
                  </View>
                  <View style={styles.roleCardText}>
                    <Text style={styles.roleLabel}>{role.label}</Text>
                    <Text style={styles.roleHeadline}>{role.headline}</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      isSelected && { borderColor: role.accentColor },
                    ]}
                  >
                    {isSelected && (
                      <View style={[styles.radioInner, { backgroundColor: role.accentColor }]} />
                    )}
                  </View>
                </View>
                <View style={styles.bulletList}>
                  {role.bullets.map((bullet) => (
                    <Text key={bullet} style={styles.bullet}>
                      •{"  "}{bullet}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footer}>
          <PrimaryCTA
            label="Continue"
            onPress={handleContinue}
            loading={submitting}
          />
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    paddingTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    ...Shadows.button,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "Syne_800ExtraBold",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.body,
  },
  roleList: {
    gap: Spacing.md,
  },
  roleCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  roleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  roleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  roleCardText: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  roleHeadline: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  bulletList: {
    marginLeft: 58,
    gap: 3,
  },
  bullet: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  footer: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  signOutBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  signOutText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: "500",
  },
});
