import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { supabase } from "../lib/supabase";
import { useAuth } from "../features/auth/auth-context";

const KEYS = {
  NOTIFICATIONS_ENABLED: "@vg:notifications_enabled",
  CURRENCY: "@vg:currency",
} as const;

export type CurrencyCode = "AUD" | "USD" | "EUR" | "GBP" | "NZD";

export function useSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [currency, setCurrencyState] = useState<CurrencyCode>("AUD");
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingCurrency, setLoadingCurrency] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    (async () => {
      const [notifVal, currVal] = await Promise.all([
        AsyncStorage.getItem(KEYS.NOTIFICATIONS_ENABLED),
        AsyncStorage.getItem(KEYS.CURRENCY),
      ]);
      if (notifVal !== null) setNotificationsEnabled(notifVal === "true");
      if (currVal !== null) setCurrencyState(currVal as CurrencyCode);
    })();
  }, []);

  // ── Notifications ──
  const toggleNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      if (notificationsEnabled) {
        // Disable
        setNotificationsEnabled(false);
        await AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, "false");
      } else {
        // Request permission
        if (Platform.OS === "web") {
          setNotificationsEnabled(true);
          await AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, "true");
        } else {
          const { status: existing } = await Notifications.getPermissionsAsync();
          let finalStatus = existing;
          if (existing !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== "granted") {
            Alert.alert(
              "Permission Denied",
              "Enable notifications in your device Settings to receive updates."
            );
            return;
          }
          setNotificationsEnabled(true);
          await AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, "true");
        }
      }
    } catch {
      Alert.alert("Error", "Could not update notification settings.");
    } finally {
      setLoadingNotifications(false);
    }
  }, [notificationsEnabled]);

  // ── Currency ──
  const setCurrency = useCallback(async (code: CurrencyCode) => {
    setLoadingCurrency(true);
    try {
      setCurrencyState(code);
      await AsyncStorage.setItem(KEYS.CURRENCY, code);
    } finally {
      setLoadingCurrency(false);
    }
  }, []);

  // ── Change Password ──
  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!user) throw new Error("Not authenticated");
      if (newPassword.length < 6) {
        Alert.alert("Invalid Password", "Password must be at least 6 characters.");
        return;
      }
      setLoadingPassword(true);
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          if (error.message.includes("same")) {
            Alert.alert("Password Unchanged", "New password must be different from your current password.");
          } else {
            Alert.alert("Password Update Failed", error.message);
          }
          return;
        }
        Alert.alert("Success", "Your password has been updated.");
      } catch {
        Alert.alert("Error", "Something went wrong while updating your password.");
      } finally {
        setLoadingPassword(false);
      }
    },
    [user]
  );

  // ── Sign Out ──
  const signOut = useCallback(async () => {
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
  }, [logout, router]);

  // ── Delete Account ──
  const deleteAccount = useCallback(async () => {
    if (!user) return;
    setLoadingDelete(true);
    try {
      // Delete avatar images from storage
      const { data: avatarFiles } = await supabase.storage
        .from("charger-images")
        .list(`avatars/${user.id}`);
      if (avatarFiles && avatarFiles.length > 0) {
        const paths = avatarFiles.map((f) => `avatars/${user.id}/${f.name}`);
        await supabase.storage.from("charger-images").remove(paths);
      }

      // Delete profile record (cascades to related data via FK)
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);
      if (profileError) throw profileError;

      // Sign out (logout handles: auth.signOut → AsyncStorage.clear → reset context)
      await logout();
      router.replace("/(auth)/sign-in" as any);
    } catch {
      Alert.alert("Delete Failed", "Could not delete your account. Please try again or contact support.");
    } finally {
      setLoadingDelete(false);
    }
  }, [user, logout, router]);

  return {
    notificationsEnabled,
    currency,
    loadingNotifications,
    loadingCurrency,
    loadingPassword,
    loadingDelete,
    toggleNotifications,
    setCurrency,
    changePassword,
    signOut,
    deleteAccount,
  };
}
