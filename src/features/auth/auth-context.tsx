import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  signInWithEmail,
  signInWithGoogleCredential,
  signOutCurrentUser,
  signUpWithEmail,
  subscribeToAuthState,
} from "./auth.service";
import {
  listenToUserProfile,
  upsertUserProfile,
  updateUserProfile,
} from "../users/user.repository";
import type { AppRole, UserProfile } from "../users/user.types";
import {
  DEV_PREVIEW_MODE,
  DEV_PREVIEW_STATE,
  DEV_PREVIEW_SESSION_USER,
  buildDevProfile,
  isFirebasePermissionError,
  logDevPreviewFallback,
} from "../shared/dev-preview";

const SESSION_STORAGE_KEY = "vehiclegrid.session.v1";

type SessionIdentity = {
  uid: string;
  email: string;
  displayName: string;
};

interface AuthContextValue {
  authUser: User | null;
  sessionUser: SessionIdentity | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isProfileLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    displayName: string;
    role: AppRole;
  }) => Promise<void>;
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

interface AuthProviderProps {
  children: ReactNode;
}

function buildSessionIdentity(user: User): SessionIdentity {
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "VehicleGrid User",
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionIdentity | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  async function activateDevSession(role: AppRole = "driver", displayName?: string) {
    const nextSession: SessionIdentity = {
      uid: DEV_PREVIEW_SESSION_USER.uid,
      email: DEV_PREVIEW_SESSION_USER.email,
      displayName: displayName || DEV_PREVIEW_SESSION_USER.displayName,
    };

    setAuthUser(null);
    setSessionUser(nextSession);
    setProfile(buildDevProfile(nextSession.uid, role, nextSession.displayName, nextSession.email));
    setIsAuthResolved(true);
    setIsSessionHydrated(true);
    setIsProfileLoading(false);
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
  }

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const cached = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!isMounted || !cached) {
          return;
        }

        const parsed = JSON.parse(cached) as SessionIdentity;
        if (
          !DEV_PREVIEW_MODE &&
          parsed.uid &&
          parsed.uid === DEV_PREVIEW_SESSION_USER.uid
        ) {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          return;
        }

        if (parsed.uid) {
          setSessionUser(parsed);
        }
      } catch {
        // no-op: cache is best-effort only
      } finally {
        if (isMounted) {
          setIsSessionHydrated(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeToAuthState(
      async (nextUser) => {
        setAuthUser(nextUser);
        setIsAuthResolved(true);

        if (nextUser) {
          const nextSession = buildSessionIdentity(nextUser);
          setSessionUser(nextSession);
          await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
        }
      },
      async (error) => {
        if (!DEV_PREVIEW_MODE) {
          setIsAuthResolved(true);
          return;
        }

        logDevPreviewFallback("auth-state", error);
        await activateDevSession();
      }
    );
  }, []);

  useEffect(() => {
    if (!isAuthResolved || !isSessionHydrated) {
      return;
    }

    const activeIdentity: SessionIdentity | null =
      authUser && authUser.uid
        ? buildSessionIdentity(authUser)
        : sessionUser;

    if (!activeIdentity) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);

    const unsubscribe = listenToUserProfile(
      activeIdentity.uid,
      async (nextProfile) => {
        if (nextProfile) {
          setProfile(nextProfile);
          setIsProfileLoading(false);
          return;
        }

        try {
          await upsertUserProfile(activeIdentity.uid, {
            email: activeIdentity.email,
            displayName: activeIdentity.displayName,
            role: "driver",
          });
        } catch (error) {
          if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
            setIsProfileLoading(false);
            return;
          }

          logDevPreviewFallback("profile-upsert", error);
          setProfile(
            buildDevProfile(
              activeIdentity.uid,
              "driver",
              activeIdentity.displayName,
              activeIdentity.email
            )
          );
        } finally {
          setIsProfileLoading(false);
        }
      },
      () => {
        setProfile(null);
        setIsProfileLoading(false);
      }
    );

    return unsubscribe;
  }, [authUser, isAuthResolved, isSessionHydrated, sessionUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authUser,
      sessionUser,
      profile,
      isAuthenticated: Boolean(authUser || sessionUser),
      isBootstrapping: !isAuthResolved || !isSessionHydrated,
      isProfileLoading,
      login: async (email, password) => {
        try {
          await signInWithEmail(email, password);
        } catch (error) {
          if (!DEV_PREVIEW_MODE) {
            throw error;
          }

          logDevPreviewFallback("auth-login", error);
          await activateDevSession("driver", email.split("@")[0] || undefined);
        }
      },
      loginWithGoogle: async (idToken: string) => {
        try {
          await signInWithGoogleCredential(idToken);
          // onAuthStateChanged handles session + profile creation automatically
        } catch (error) {
          if (!DEV_PREVIEW_MODE) {
            throw error;
          }

          logDevPreviewFallback("auth-google", error);
          await activateDevSession("driver", "Google User");
        }
      },
      signup: async ({ email, password, displayName, role }) => {
        try {
          await signUpWithEmail(email, password, displayName, role);
        } catch (error) {
          if (!DEV_PREVIEW_MODE) {
            throw error;
          }

          logDevPreviewFallback("auth-signup", error);
          await activateDevSession(role, displayName);
        }
      },
      logout: async () => {
        setSessionUser(null);
        setProfile(null);
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);

        try {
          await signOutCurrentUser();
        } catch (error) {
          if (!DEV_PREVIEW_MODE) {
            throw error;
          }

          logDevPreviewFallback("auth-logout", error);
        }
      },
      updateProfileDetails: async (patch) => {
        const uid = authUser?.uid || sessionUser?.uid;

        if (!uid) {
          throw new Error("Not authenticated");
        }

        // Filter out undefined values — Firestore rejects them
        const cleanPatch = Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined)
        );

        if (Object.keys(cleanPatch).length === 0) {
          return; // Nothing to update
        }

        try {
          await updateUserProfile(uid, cleanPatch);
        } catch (error) {
          if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
            throw error;
          }

          logDevPreviewFallback("profile-update", error);
          setProfile((current) => {
            const fallbackBase =
              current ||
              buildDevProfile(
                uid,
                patch.role || "driver",
                patch.displayName,
                sessionUser?.email
              );

            const next: UserProfile = {
              ...fallbackBase,
              ...patch,
              id: uid,
              role: patch.role || fallbackBase.role,
              displayName: patch.displayName || fallbackBase.displayName,
              phone: patch.phone ?? fallbackBase.phone,
              preferredReservePercent:
                patch.preferredReservePercent ?? fallbackBase.preferredReservePercent,
              updatedAtIso: new Date().toISOString(),
            };

            DEV_PREVIEW_STATE.profiles[uid] = next;
            return next;
          });
        }
      },
    }),
    [authUser, isAuthResolved, isProfileLoading, isSessionHydrated, profile, sessionUser]
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
