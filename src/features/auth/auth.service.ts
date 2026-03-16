import { supabase } from "../../lib/supabase";
import type { AppRole } from "../users/user.types";

export async function signInWithEmail(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (__DEV__) console.log("[auth.service] signInWithEmail:", normalizedEmail);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) {
    if (__DEV__) console.error("[auth.service] signInWithEmail failed:", error.message);
    throw error;
  }
  if (__DEV__) console.log("[auth.service] signInWithEmail success, user:", data.user?.id);
  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  role: AppRole
) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = displayName.trim() || "VehicleGrid User";
  if (__DEV__) console.log("[auth.service] signUpWithEmail:", normalizedEmail, "role:", role);

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { display_name: normalizedName, role },
    },
  });
  if (error) {
    if (__DEV__) console.error("[auth.service] signUpWithEmail failed:", error.message);
    throw error;
  }

  // Detect email-confirmation-required: Supabase returns a user but
  // no session when "Confirm email" is enabled in the dashboard.
  const needsConfirmation = data.user && !data.session;
  if (__DEV__) {
    console.log(
      "[auth.service] signUpWithEmail result — user:",
      data.user?.id,
      "| session:",
      data.session ? "YES" : "NONE",
      needsConfirmation ? "⚠️ email confirmation required" : ""
    );
  }

  // Upsert the profile with role and display name — handles both
  // the case where the DB trigger created it and where it didn't.
  if (data.user) {
    if (__DEV__) console.log("[auth.service] upserting profile for:", data.user.id);
    await supabase
      .from("profiles")
      .upsert({
        id: data.user.id,
        email: normalizedEmail,
        display_name: normalizedName,
        role,
      });
  }

  if (needsConfirmation) {
    throw new Error(
      "Account created! Please check your email and click the confirmation link, then sign in."
    );
  }

  return data;
}

export async function signOutCurrentUser() {
  if (__DEV__) console.log("[auth.service] signOut");
  const { error } = await supabase.auth.signOut();
  if (error) {
    // Supabase can return this when the local session is already gone.
    // Treat it as effectively signed out.
    if (error.message.toLowerCase().includes("auth session missing")) {
      return;
    }
    if (__DEV__) console.error("[auth.service] signOut failed:", error.message);
    throw error;
  }
}

export async function signInWithGoogle(idToken: string) {
  if (__DEV__) console.log("[auth.service] signInWithGoogle, token length:", idToken.length);
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) {
    if (__DEV__) console.error("[auth.service] signInWithGoogle failed:", error.message);
    throw error;
  }
  if (__DEV__) console.log("[auth.service] signInWithGoogle success, user:", data.user?.id);
  return data;
}

export function subscribeToAuthState(
  callback: (user: { id: string; email?: string } | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (__DEV__) console.log("[auth.service] onAuthStateChange:", _event, session?.user?.id ?? "null");
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
