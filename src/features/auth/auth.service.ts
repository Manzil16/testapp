import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { upsertUserProfile } from "../users/user.repository";
import type { AppRole } from "../users/user.types";

export async function signInWithEmail(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return signInWithEmailAndPassword(auth, normalizedEmail, password);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  role: AppRole
) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = displayName.trim() || "VehicleGrid User";

  const credentials = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

  await updateProfile(credentials.user, {
    displayName: normalizedName,
  });

  await upsertUserProfile(credentials.user.uid, {
    email: normalizedEmail,
    displayName: normalizedName,
    role,
  });

  return credentials;
}

export async function signOutCurrentUser() {
  await signOut(auth);
}

/**
 * Sign in with a Google ID token received from expo-auth-session.
 * Firebase creates/links the account automatically.
 * A Firestore profile is created by the auth-context listener on first sign-in.
 */
export async function signInWithGoogleCredential(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export function subscribeToAuthState(
  callback: (user: User | null) => void,
  onError?: (error: unknown) => void
) {
  return onAuthStateChanged(auth, callback, onError);
}
