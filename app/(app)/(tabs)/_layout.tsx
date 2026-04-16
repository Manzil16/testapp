import { useCallback } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useAuth } from "@/src/features/auth/auth-context";
import { BadgeWrapper } from "@/src/components";
import { Colors, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { useBadgeCounts } from "@/src/hooks";

function icon(name: keyof typeof Ionicons.glyphMap) {
  const TabIcon = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

const sharedHeaderOptions = {
  headerShown: true,
  headerBackVisible: false,
  headerLeft: () => null,
  headerStyle: {
    backgroundColor: Colors.surface,
    elevation: 0,
    shadowOpacity: 0,
  } as const,
  headerTintColor: Colors.textPrimary,
  headerTitleStyle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
  },
  headerShadowVisible: false,
};

const sharedOptions = {
  headerShown: false,
  tabBarActiveTintColor: Colors.accent,
  tabBarInactiveTintColor: Colors.textMuted,
  tabBarLabelStyle: {
    ...Typography.badge,
    fontSize: 10,
    fontWeight: "600" as const,
  },
  tabBarStyle: {
    height: 68,
    paddingTop: Spacing.sm,
    paddingBottom: 10,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    ...Shadows.sticky,
  },
};

export default function AppTabsLayout() {
  const { profile } = useAuth();
  const { counts } = useBadgeCounts();
  const isDriver = profile?.isDriver ?? false;
  const isHost = profile?.isHost ?? false;
  const isAdmin = profile?.isAdmin ?? false;

  const avatarUri = profile?.avatarUrl;

  const BookingsIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => (
      <BadgeWrapper count={counts.sessions}>
        <Ionicons name="calendar" size={size} color={color} />
      </BadgeWrapper>
    ),
    [counts.sessions]
  );

  const HostHomeIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => (
      <BadgeWrapper count={counts.messages}>
        <Ionicons name="home" size={size} color={color} />
      </BadgeWrapper>
    ),
    [counts.messages]
  );

  const HostChargersIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => (
      <BadgeWrapper count={counts.chargerUpdates}>
        <Ionicons name="flash" size={size} color={color} />
      </BadgeWrapper>
    ),
    [counts.chargerUpdates]
  );

  const HostBookingsIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => (
      <BadgeWrapper count={counts.sessions}>
        <Ionicons name="calendar" size={size} color={color} />
      </BadgeWrapper>
    ),
    [counts.sessions]
  );

  const AdminVerifyIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => (
      <BadgeWrapper count={counts.pendingVerifications}>
        <Ionicons name="shield-checkmark" size={size} color={color} />
      </BadgeWrapper>
    ),
    [counts.pendingVerifications]
  );

  const ProfileTabIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => {
      const inner = avatarUri ? (
        <View
          style={[
            styles.avatarTab,
            {
              width: size - 2,
              height: size - 2,
              borderRadius: (size - 2) / 2,
              borderColor: color === Colors.accent ? Colors.accent : Colors.border,
            },
          ]}
        >
          <Image
            source={{ uri: avatarUri }}
            style={{
              width: size - 6,
              height: size - 6,
              borderRadius: (size - 6) / 2,
            }}
          />
        </View>
      ) : (
        <Ionicons name="person-circle" size={size} color={color} />
      );

      return (
        <BadgeWrapper count={counts.profile}>
          {inner}
        </BadgeWrapper>
      );
    },
    [avatarUri, counts.profile]
  );

  return (
    <Tabs screenOptions={sharedOptions}>
      {/* Driver tabs */}
      <Tabs.Screen
        name="dashboard"
        options={{
          ...sharedHeaderOptions,
          title: "Home",
          href: isDriver ? undefined : null,
          tabBarIcon: icon("home"),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          ...sharedHeaderOptions,
          title: "Explore",
          href: isDriver ? undefined : null,
          tabBarIcon: icon("search"),
        }}
      />
      <Tabs.Screen
        name="trip"
        options={{
          ...sharedHeaderOptions,
          title: "Trips",
          href: isDriver ? undefined : null,
          tabBarIcon: icon("map"),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          ...sharedHeaderOptions,
          title: "Bookings",
          href: isDriver ? undefined : null,
          tabBarIcon: BookingsIcon,
        }}
      />
      <Tabs.Screen
        name="range-calculator"
        options={{
          ...sharedHeaderOptions,
          title: "Range",
          href: isDriver ? undefined : null,
          tabBarIcon: icon("speedometer-outline"),
        }}
      />

      {/* Host tabs */}
      <Tabs.Screen
        name="host-home"
        options={{
          ...sharedHeaderOptions,
          title: "Home",
          href: isHost ? undefined : null,
          tabBarIcon: HostHomeIcon,
        }}
      />
      <Tabs.Screen
        name="host-chargers"
        options={{
          ...sharedHeaderOptions,
          title: "Chargers",
          href: isHost ? undefined : null,
          tabBarIcon: HostChargersIcon,
        }}
      />
      <Tabs.Screen
        name="host-bookings"
        options={{
          ...sharedHeaderOptions,
          title: "Bookings",
          href: isHost ? undefined : null,
          tabBarIcon: HostBookingsIcon,
        }}
      />

      {/* Admin tabs */}
      <Tabs.Screen
        name="admin-overview"
        options={{
          ...sharedHeaderOptions,
          title: "Overview",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("grid"),
        }}
      />
      <Tabs.Screen
        name="admin-verify"
        options={{
          ...sharedHeaderOptions,
          title: "Verify",
          href: isAdmin ? undefined : null,
          tabBarIcon: AdminVerifyIcon,
        }}
      />
      <Tabs.Screen
        name="admin-trust"
        options={{
          ...sharedHeaderOptions,
          title: "Trust",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("people"),
        }}
      />
      <Tabs.Screen
        name="admin-settings"
        options={{
          ...sharedHeaderOptions,
          title: "Config",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("settings"),
        }}
      />

      {/* Profile (driver + host + admin) */}
      <Tabs.Screen
        name="profile"
        options={{
          ...sharedHeaderOptions,
          title: "Profile",
          href: isDriver || isHost || isAdmin ? undefined : null,
          tabBarIcon: ProfileTabIcon,
        }}
      />

      {/* Legacy tab route retained for deep-link compatibility */}
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  avatarTab: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
