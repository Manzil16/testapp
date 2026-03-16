import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, testSupabaseConnectivity } from "../../lib/supabase";
import {
  signInWithEmail,
  signInWithGoogle,
  signOutCurrentUser,
  signUpWithEmail,
  subscribeToAuthState,
} from "./auth.service";
import type { AppRole, UserProfile } from "../users/user.types";

type SupabaseUser = { id: string; email?: string };

interface AuthContextValue {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isProfileLoading: boolean;
  needsRoleSelection: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    displayName: string;
    role: AppRole;
  }) => Promise<void>;
  createProfile: (role: AppRole) => Promise<void>;
  logout: () => Promise<void>;
  updateProfileDetails: (patch: {
    displayName?: string;
    phone?: string;
    avatarUrl?: string;
    preferredReservePercent?: number;
    role?: AppRole;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: row.display_name as string,
    role: row.role as AppRole,
    phone: (row.phone as string) || undefined,
    avatarUrl: (row.avatar_url as string) || undefined,
    preferredReservePercent: row.preferred_reserve_percent as number,
    stripeAccountId: (row.stripe_account_id as string) || undefined,
    createdAtIso: row.created_at as string,
    updatedAtIso: row.updated_at as string,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);

  // Bootstrap: verify connectivity then check existing session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (__DEV__) {
        const reachable = await testSupabaseConnectivity();
        if (!reachable && !cancelled) {
          console.warn(
            "[auth] Supabase is unreachable. Check EXPO_PUBLIC_SUPABASE_URL " +
              "and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local"
          );
        }
      }
      const { data: { session }, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (__DEV__ && error) {
        console.error("[auth] getSession error:", error.message);
      }
      setUser(session?.user ?? null);
      setIsBootstrapping(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    return subscribeToAuthState((nextUser) => {
      if (__DEV__) console.log("[auth] auth state changed — user:", nextUser?.id ?? "null");
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setNeedsRoleSelection(false);
      }
    });
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setNeedsRoleSelection(false);
      setIsProfileLoading(false);
      return;
    }

    if (__DEV__) console.log("[auth] user set, fetching profile for:", user.id);
    setIsProfileLoading(true);

    // Subscribe to realtime profile changes
    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === "object" && "id" in payload.new) {
            if (__DEV__) console.log("[auth] profile realtime update received");
            setProfile(mapProfile(payload.new as Record<string, unknown>));
          }
        }
      )
      .subscribe();

    // Initial fetch with retry — the auto-create trigger may not have
    // finished by the time we query, especially right after sign-up.
    // If profile doesn't exist after retries, flag for role selection.
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const fetchProfile = async (attempt: number) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      if (data && !error) {
        if (__DEV__) console.log("[auth] profile loaded:", data.display_name, "role:", data.role);
        setProfile(mapProfile(data as Record<string, unknown>));
        setNeedsRoleSelection(false);
        setIsProfileLoading(false);
      } else {
        if (__DEV__) {
          console.warn(
            `[auth] profile fetch attempt ${attempt} failed:`,
            error?.message || "no data",
            error?.code || ""
          );
        }
        if (attempt < 3) {
          retryTimer = setTimeout(() => fetchProfile(attempt + 1), attempt * 1000);
        } else {
          // No profile found — user needs to pick a role
          if (__DEV__) console.log("[auth] no profile after retries, needs role selection");
          setNeedsRoleSelection(true);
          setIsProfileLoading(false);
        }
      }
    };

    fetchProfile(1);

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      isProfileLoading,
      needsRoleSelection,
      login: async (email, password) => {
        await signInWithEmail(email, password);
      },
      loginWithGoogle: async (idToken: string) => {
        await signInWithGoogle(idToken);
      },
      signup: async ({ email, password, displayName, role }) => {
        const result = await signUpWithEmail(email, password, displayName, role);
        // If we have a session, immediately refresh and fetch the profile
        // so the role is available before navigation happens.
        if (result.session && result.user) {
          await supabase.auth.refreshSession();
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", result.user.id)
            .single();
          if (profileData) {
            setProfile(mapProfile(profileData as Record<string, unknown>));
            setNeedsRoleSelection(false);
          }
        }
      },
      createProfile: async (role: AppRole) => {
        if (!user) throw new Error("Not authenticated");

        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error("Could not get auth user");

        const meta = authUser.user_metadata ?? {};
        const displayName = (meta.display_name as string)
          || (meta.full_name as string)
          || (meta.name as string)
          || "VehicleGrid User";
        const email = authUser.email || "";

        if (__DEV__) {
          console.log("[auth] creating profile:", { displayName, role, email });
        }

        const { data, error } = await supabase
          .from("profiles")
          .upsert({
            id: authUser.id,
            email,
            display_name: displayName,
            role,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setProfile(mapProfile(data as Record<string, unknown>));
          setNeedsRoleSelection(false);
        }
      },
      logout: async () => {
        await signOutCurrentUser();

        try {
          await AsyncStorage.clear();
        } catch {
          // ignore AsyncStorage errors during sign out
        }

        setUser(null);
        setProfile(null);
        setNeedsRoleSelection(false);
      },
      updateProfileDetails: async (patch) => {
        if (!user) throw new Error("Not authenticated");

        const updatePayload: Record<string, unknown> = {};
        if (patch.displayName !== undefined) updatePayload.display_name = patch.displayName;
        if (patch.phone !== undefined) updatePayload.phone = patch.phone;
        if (patch.avatarUrl !== undefined) updatePayload.avatar_url = patch.avatarUrl;
        if (patch.preferredReservePercent !== undefined)
          updatePayload.preferred_reserve_percent = patch.preferredReservePercent;
        if (patch.role !== undefined) updatePayload.role = patch.role;

        if (Object.keys(updatePayload).length === 0) return;

        const { error } = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", user.id);
        if (error) throw error;
      },
    }),
    [user, profile, isBootstrapping, isProfileLoading, needsRoleSelection]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
