import { Redirect } from "expo-router";
import { useAuth } from "@/src/features/auth/auth-context";

export default function SessionHistoryScreen() {
  const { profile } = useAuth();

  if (profile?.role === "host") {
    return <Redirect href={"/(app)/(tabs)/host-bookings?segment=completed" as any} />;
  }

  return <Redirect href={"/(app)/(tabs)/bookings?segment=past&filter=unrated&fromBadge=sessions" as any} />;
}
