import "react-native-get-random-values";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
import { ThemeProvider } from "@/src/features/shared/ThemeProvider";
import { NetworkBanner } from "@/src/components";
import type { AppRole } from "@/src/features/users";

// ─── UUID validation ──────────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// Configure notification display when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.icon}>⚡</Text>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || "An unexpected error occurred."}
          </Text>
          <Pressable
            style={errorStyles.btn}
            onPress={() => {
              try {
                Updates.reloadAsync();
              } catch {
                // expo-updates not available (e.g. dev client) — reset state instead
                this.setState({ hasError: false, error: null });
              }
            }}
          >
            <Text style={errorStyles.btnText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

// ─── Splash overlay ───────────────────────────────────────────────────────────
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

// ─── Route gate ───────────────────────────────────────────────────────────────
function AppRouteGate({ themeColors }: { themeColors: { background: string } }) {
  const router = useRouter();
  const segments = useSegments() as string[];

  // useAuth() errors are caught by the wrapping AppErrorBoundary
  const { isAuthenticated, profile, isBootstrapping, isProfileLoading, needsRoleSelection } =
    useAuth();

  const authLoading = isBootstrapping || isProfileLoading;
  const [splashHidden, setSplashHidden] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const notificationResponseListener = useRef<Notifications.EventSubscription>();

  // Handle notification taps — validate bookingId before navigating
  useEffect(() => {
    if (Platform.OS === "web") return;

    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;

        try {
          if (data?.screen === "booking-detail" && data?.bookingId) {
            if (!isValidUUID(data.bookingId)) {
              console.warn("[nav] Invalid bookingId in notification payload:", data.bookingId);
              Alert.alert("Navigation Error", "Booking not found.");
              return;
            }
            router.push(`/(app)/bookings/${data.bookingId}` as any);
          } else if (data?.screen === "host-booking-detail" && data?.bookingId) {
            if (!isValidUUID(data.bookingId)) {
              console.warn("[nav] Invalid bookingId in notification payload:", data.bookingId);
              Alert.alert("Navigation Error", "Booking not found.");
              return;
            }
            router.push(`/(app)/host/booking/${data.bookingId}` as any);
          }
        } catch (err) {
          console.error("[nav] Deep-link navigation failed:", err);
          Alert.alert("Navigation Error", "Booking not found. Please check your Bookings tab.");
        }
      });

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, [router]);

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

    try {
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
    } catch (err) {
      console.error("[AppRouteGate] Routing error:", err);
    }
  }, [isAuthenticated, isBootstrapping, isProfileLoading, needsRoleSelection, profile, router, segments]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.background },
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

function AppRouteGateWithTheme() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <AppRouteGate themeColors={Colors} />
      <StatusBar style="dark" />
    </View>
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
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRouteGateWithTheme />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
