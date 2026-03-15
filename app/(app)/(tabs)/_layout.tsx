import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useAuth } from "@/src/features/auth/auth-context";
import { Colors, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

function icon(name: keyof typeof Ionicons.glyphMap) {
  const TabIcon = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

const sharedOptions = {
  headerShown: false,
  tabBarActiveTintColor: Colors.primary,
  tabBarInactiveTintColor: Colors.textMuted,
  tabBarLabelStyle: {
    ...Typography.caption,
    fontWeight: "600" as const,
  },
  tabBarStyle: {
    height: 64,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 0,
    backgroundColor: Colors.surface,
    ...Shadows.modal,
  },
};

export default function AppTabsLayout() {
  const { profile } = useAuth();
  const role = profile?.role || "driver";

  const isDriver = role === "driver";
  const isHost = role === "host";
  const isAdmin = role === "admin";

  // Avatar tab icon for profile
  const avatarUri = profile?.avatarUrl;
  const ProfileTabIcon = ({ color, size }: { color: string; size: number }) => {
    if (avatarUri) {
      const avatarSize = size - 2;
      const isActive = color === Colors.primary;
      return (
        <View
          style={[
            styles.avatarTab,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              borderColor: isActive ? Colors.primary : Colors.border,
            },
          ]}
        >
          <Image
            source={{ uri: avatarUri }}
            style={{
              width: avatarSize - 4,
              height: avatarSize - 4,
              borderRadius: (avatarSize - 4) / 2,
            }}
          />
        </View>
      );
    }
    return <Ionicons name="person-circle" size={size} color={color} />;
  };

  return (
    <Tabs screenOptions={sharedOptions}>
      {/* ── Driver tabs ── */}
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
          tabBarIcon: icon("calendar"),
        }}
      />

      {/* ── Host tabs ── */}
      <Tabs.Screen
        name="host-home"
        options={{
          title: "Home",
          href: isHost ? undefined : null,
          tabBarIcon: icon("home"),
        }}
      />
      <Tabs.Screen
        name="host-chargers"
        options={{
          title: "Chargers",
          href: isHost ? undefined : null,
          tabBarIcon: icon("flash"),
        }}
      />
      <Tabs.Screen
        name="host-bookings"
        options={{
          title: "Bookings",
          href: isHost ? undefined : null,
          tabBarIcon: icon("calendar"),
        }}
      />

      {/* ── Admin tabs ── */}
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
          tabBarIcon: icon("shield-checkmark"),
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

      {/* ── Profile (driver + host) ── */}
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
