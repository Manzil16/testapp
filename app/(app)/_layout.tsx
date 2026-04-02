import { Stack } from "expo-router";

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
        }}
      />
      <Stack.Screen
        name="checkout"
        options={{ title: "Confirm booking" }}
      />
      <Stack.Screen
        name="bookings/[bookingId]"
        options={{ title: "Booking details" }}
      />
      <Stack.Screen
        name="host/booking/[bookingId]"
        options={{ title: "Booking request" }}
      />
      <Stack.Screen
        name="host/charger-form"
        options={{ title: "Add charger" }}
      />
      <Stack.Screen
        name="payment-success"
        options={{ title: "", headerBackVisible: false }}
      />
      <Stack.Screen
        name="session-history"
        options={{ title: "Session history" }}
      />
      <Stack.Screen
        name="notifications"
        options={{ title: "Notifications" }}
      />
      <Stack.Screen
        name="verification-required"
        options={{ title: "Complete verification" }}
      />
      <Stack.Screen
        name="driver/vehicle"
        options={{ title: "Vehicle profile" }}
      />
      <Stack.Screen
        name="wishlist"
        options={{ title: "Saved Chargers", headerShown: false }}
      />
      <Stack.Screen
        name="help"
        options={{ title: "Help & Support", headerShown: false }}
      />
      <Stack.Screen
        name="host/analytics"
        options={{ title: "Analytics", headerShown: false }}
      />
    </Stack>
  );
}
