import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="chargers/[chargerId]"
        options={{
          animation: "slide_from_bottom",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="host/charger-form"
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="driver/vehicle"
        options={{
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
