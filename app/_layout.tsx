import "react-native-get-random-values";
import * as SplashScreen from "expo-splash-screen";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Syne_400Regular,
  Syne_500Medium,
  Syne_600SemiBold,
  Syne_700Bold,
  Syne_800ExtraBold,
} from "@expo-google-fonts/syne";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { AuthProvider, useAuth } from "../src/features/auth/auth-context";
import { queryClient } from "../src/lib/query-client";
import { Colors } from "@/src/features/shared/theme";
import { NetworkBanner } from "@/src/components";
import type { AppRole } from "@/src/features/users";

SplashScreen.preventAutoHideAsync();

const tabByRole: Record<AppRole, string> = {
  driver: "/(app)/(tabs)/dashboard",
  host: "/(app)/(tabs)/host-home",
  admin: "/(app)/(tabs)/admin-overview",
};

const allowedTabsByRole: Record<AppRole, Set<string>> = {
  driver: new Set(["dashboard", "discover", "trip", "bookings", "profile", "settings"]),
  host: new Set(["host-home", "host-chargers", "host-bookings", "profile", "settings"]),
  admin: new Set(["admin-overview", "admin-verify", "admin-trust", "admin-settings"]),
};

function AnimatedSplashOverlay({ onFinished }: { onFinished: () => void }) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(200, withTiming(0, { duration: 500 }));
    translateY.value = withDelay(200, withTiming(-30, { duration: 500 }));

    const timer = setTimeout(() => {
      onFinished();
    }, 750);

    return () => clearTimeout(timer);
  }, [onFinished, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, splashStyles.container, animatedStyle]}>
      <Text style={splashStyles.icon}>⚡</Text>
      <Text style={splashStyles.title}>VehicleGrid</Text>
      <Text style={splashStyles.tagline}>Charge smarter. Share better.</Text>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  icon: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.accent,
    letterSpacing: 1,
    fontFamily: "Syne_800ExtraBold",
  },
  tagline: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textSecondary,
    marginTop: 8,
    fontFamily: "DMSans_500Medium",
  },
});

function AppRouteGate() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { isAuthenticated, profile, isBootstrapping, isProfileLoading, needsRoleSelection } = useAuth();

  const authLoading = isBootstrapping || isProfileLoading;
  const [splashHidden, setSplashHidden] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);

  useEffect(() => {
    if (!authLoading && !splashHidden) {
      SplashScreen.hideAsync();
      setSplashHidden(true);
    }
  }, [authLoading, splashHidden]);

  const handleOverlayFinished = useCallback(() => {
    setOverlayVisible(false);
  }, []);

  useEffect(() => {
    if (isBootstrapping || isProfileLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAppGroup = segments[0] === "(app)";
    const area = segments[1] || "";
    const activeTab = segments[2] || "";

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace("/(auth)/sign-in" as any);
      }
      return;
    }

    // Authenticated but no profile — send to role selection
    if (needsRoleSelection) {
      if (segments[1] !== "select-role") {
        router.replace("/(auth)/select-role" as any);
      }
      return;
    }

    if (!profile) return;

    const defaultAppRoute = tabByRole[profile.role] || tabByRole.driver;

    if (inAuthGroup || !inAppGroup) {
      router.replace(defaultAppRoute as any);
      return;
    }

    if (area === "(tabs)") {
      if (!activeTab) return;
      const allowedTabs = allowedTabsByRole[profile.role] || allowedTabsByRole.driver;
      if (!allowedTabs.has(activeTab)) {
        router.replace(defaultAppRoute as any);
      }
      return;
    }

    if (area === "admin" && profile.role !== "admin") {
      router.replace(defaultAppRoute as any);
      return;
    }
    if (area === "host" && profile.role !== "host") {
      router.replace(defaultAppRoute as any);
      return;
    }
    if (area === "driver" && profile.role !== "driver") {
      router.replace(defaultAppRoute as any);
    }
  }, [isAuthenticated, isBootstrapping, isProfileLoading, needsRoleSelection, profile, router, segments]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: "fade",
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <NetworkBanner />
      {overlayVisible && splashHidden ? (
        <AnimatedSplashOverlay onFinished={handleOverlayFinished} />
      ) : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Syne_400Regular,
    Syne_500Medium,
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRouteGate />
        </AuthProvider>
      </QueryClientProvider>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
