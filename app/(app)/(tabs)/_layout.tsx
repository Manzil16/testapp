import { useCallback } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useAuth } from "@/src/features/auth/auth-context";
import { BadgeWrapper } from "@/src/components";
import { Colors, Shadows, Typography } from "@/src/features/shared/theme";
import { useBadgeCounts } from "@/src/hooks";

function icon(name: keyof typeof Ionicons.glyphMap) {
  const TabIcon = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

const sharedOptions = {
  headerShown: false,
  tabBarActiveTintColor: Colors.accent,
  tabBarInactiveTintColor: Colors.textMuted,
  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: "600" as const,
    fontFamily: "DMSans_600SemiBold",
  },
  tabBarStyle: {
    height: 68,
    paddingTop: 8,
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
  const role = profile?.role || "driver";

  const isDriver = role === "driver";
  const isHost = role === "host";
  const isAdmin = role === "admin";

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
          title: "Home",
          href: isDriver ? undefined : null,
          tabBarIcon: icon("home"),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Explore",
          href: isDriver ? undefined : null,
          tabBarIcon: icon("search"),
        }}
      />
      <Tabs.Screen
        name="trip"
        options={{
          title: "Trips",
          href: isDriver ? undefined : null,
          tabBarIcon: icon("map"),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          href: isDriver ? undefined : null,
          tabBarIcon: BookingsIcon,
        }}
      />

      {/* Host tabs */}
      <Tabs.Screen
        name="host-home"
        options={{
          title: "Home",
          href: isHost ? undefined : null,
          tabBarIcon: HostHomeIcon,
        }}
      />
      <Tabs.Screen
        name="host-chargers"
        options={{
          title: "Chargers",
          href: isHost ? undefined : null,
          tabBarIcon: HostChargersIcon,
        }}
      />
      <Tabs.Screen
        name="host-bookings"
        options={{
          title: "Bookings",
          href: isHost ? undefined : null,
          tabBarIcon: HostBookingsIcon,
        }}
      />

      {/* Admin tabs */}
      <Tabs.Screen
        name="admin-overview"
        options={{
          title: "Overview",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("grid"),
        }}
      />
      <Tabs.Screen
        name="admin-verify"
        options={{
          title: "Verify",
          href: isAdmin ? undefined : null,
          tabBarIcon: AdminVerifyIcon,
        }}
      />
      <Tabs.Screen
        name="admin-trust"
        options={{
          title: "Trust",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("people"),
        }}
      />
      <Tabs.Screen
        name="admin-settings"
        options={{
          title: "Settings",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("settings"),
        }}
      />

      {/* Profile (driver + host) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: isDriver || isHost ? undefined : null,
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
