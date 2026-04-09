import { Stack } from "expo-router";
import { Colors, Typography } from "@/src/features/shared/theme";

const sharedStackOptions = {
  headerStyle: {
    backgroundColor: Colors.surface,
  },
  headerTintColor: Colors.textPrimary,
  headerTitleStyle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
  },
  headerBackTitle: "Back",
  headerShadowVisible: false,
} as const;

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="chargers/[chargerId]"
        options={{
          headerShown: true,
          headerTitle: "",
          headerTransparent: true,
          headerBackTitle: "Back",
          headerTintColor: Colors.textInverse,
        }}
      />
      <Stack.Screen
        name="checkout"
        options={{ ...sharedStackOptions, title: "Confirm booking" }}
      />
      <Stack.Screen
        name="bookings/[bookingId]"
        options={{ ...sharedStackOptions, title: "Booking details" }}
      />
      <Stack.Screen
        name="host/booking/[bookingId]"
        options={{ ...sharedStackOptions, title: "Booking request" }}
      />
      <Stack.Screen
        name="host/charger-form"
        options={{ ...sharedStackOptions, title: "Add charger" }}
      />
      <Stack.Screen
        name="payment-success"
        options={{ ...sharedStackOptions, title: "", headerBackVisible: false }}
      />
      <Stack.Screen
        name="session-history"
        options={{ ...sharedStackOptions, title: "Session history" }}
      />
      <Stack.Screen
        name="notifications"
        options={{ ...sharedStackOptions, title: "Notifications" }}
      />
      <Stack.Screen
        name="verification-required"
        options={{ ...sharedStackOptions, title: "Complete verification" }}
      />
      <Stack.Screen
        name="driver/vehicle"
        options={{ ...sharedStackOptions, title: "Vehicle profile" }}
      />
      <Stack.Screen
        name="wishlist"
        options={{ ...sharedStackOptions, title: "Saved chargers" }}
      />
      <Stack.Screen
        name="help"
        options={{ ...sharedStackOptions, title: "Help & Support" }}
      />
      <Stack.Screen
        name="host/analytics"
        options={{ ...sharedStackOptions, title: "Analytics" }}
      />
    </Stack>
  );
}
