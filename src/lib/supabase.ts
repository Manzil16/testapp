import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// ─── Supabase credentials ───────────────────────────────────────────
// To isolate "Network request failed" errors, paste your real values
// directly below. Once connectivity is confirmed, revert to env vars.
//
// const SUPABASE_URL = "https://YOUR_REAL_PROJECT.supabase.co";
// const SUPABASE_ANON_KEY = "YOUR_REAL_ANON_KEY";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Log at module load so missing/malformed values are immediately visible
if (__DEV__) {
  console.log(
    "[supabase] init — URL:",
    SUPABASE_URL ? `${SUPABASE_URL.slice(0, 30)}…` : "⚠️ MISSING",
    "| Key:",
    SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 12)}…` : "⚠️ MISSING"
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Quick connectivity check — call from a useEffect to confirm the
 * device can actually reach Supabase before attempting auth calls.
 * Returns true if reachable, false otherwise. Logs the outcome.
 */
export async function testSupabaseConnectivity(): Promise<boolean> {
  try {
    // Use the auth health endpoint — it works with any valid API key,
    // unlike /rest/v1/ which requires a JWT Bearer token.
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    });
    const ok = response.ok;
    if (__DEV__) {
      console.log(
        `[supabase] connectivity test: ${ok ? "✅ reachable" : `❌ HTTP ${response.status}`}`
      );
    }
    return ok;
  } catch (err) {
    if (__DEV__) {
      console.error(
        "[supabase] connectivity test: ❌ network error —",
        err instanceof Error ? err.message : err
      );
    }
    return false;
  }
}
