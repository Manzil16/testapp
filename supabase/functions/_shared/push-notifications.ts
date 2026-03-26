import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * Send a push notification to a user via Expo Push Notifications.
 * Silently fails if no token exists — push is non-critical.
 */
export async function sendPushNotification(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("id", userId)
      .single();

    if (!profile?.expo_push_token) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: profile.expo_push_token,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }),
    });
  } catch {
    // Silently fail — push notifications should never block operations
  }
}
