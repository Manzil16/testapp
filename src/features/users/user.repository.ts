import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import type { UpsertUserProfileInput, UserProfile } from "./user.types";
import {
  DEV_PREVIEW_MODE,
  DEV_PREVIEW_STATE,
  buildDevProfile,
  isFirebasePermissionError,
  logDevPreviewFallback,
} from "../shared/dev-preview";

interface UserProfileDoc {
  email: string;
  displayName: string;
  role: UserProfile["role"];
  phone?: string;
  avatarUrl?: string;
  preferredReservePercent?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function timestampToIso(value?: Timestamp): string {
  if (!value) {
    return new Date().toISOString();
  }

  return value.toDate().toISOString();
}

function mapUserProfile(id: string, data: UserProfileDoc): UserProfile {
  return {
    id,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    phone: data.phone,
    avatarUrl: data.avatarUrl,
    preferredReservePercent: data.preferredReservePercent,
    createdAtIso: timestampToIso(data.createdAt),
    updatedAtIso: timestampToIso(data.updatedAt),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getDevProfile(userId: string): UserProfile {
  return DEV_PREVIEW_STATE.profiles[userId] || buildDevProfile(userId, "driver");
}

export async function upsertUserProfile(
  userId: string,
  payload: UpsertUserProfileInput
): Promise<void> {
  const ref = doc(db, "users", userId);

  try {
    await setDoc(
      ref,
      {
        email: payload.email,
        displayName: payload.displayName,
        role: payload.role,
        phone: payload.phone || "",
        preferredReservePercent: payload.preferredReservePercent ?? 12,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("users.upsertUserProfile", error);
    DEV_PREVIEW_STATE.profiles[userId] = {
      id: userId,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      phone: payload.phone,
      preferredReservePercent: payload.preferredReservePercent ?? 12,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const ref = doc(db, "users", userId);

  try {
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return null;
    }

    return mapUserProfile(snapshot.id, snapshot.data() as UserProfileDoc);
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("users.getUserProfile", error);
    return getDevProfile(userId);
  }
}

export function listenToUserProfile(
  userId: string,
  callback: (profile: UserProfile | null) => void,
  onError?: (message: string) => void
): () => void {
  const ref = doc(db, "users", userId);

  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback(mapUserProfile(snapshot.id, snapshot.data() as UserProfileDoc));
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        onError?.(errorMessage(error, "Unable to listen for user profile."));
        return;
      }

      logDevPreviewFallback("users.listenToUserProfile", error);
      callback(getDevProfile(userId));
      unsubscribe();
    }
  );

  return unsubscribe;
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<UpsertUserProfileInput> & { avatarUrl?: string }
): Promise<void> {
  const ref = doc(db, "users", userId);

  try {
    await updateDoc(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("users.updateUserProfile", error);
    const current = getDevProfile(userId);
    DEV_PREVIEW_STATE.profiles[userId] = {
      ...current,
      ...patch,
      id: userId,
      updatedAtIso: new Date().toISOString(),
    };
  }
}
