import { serverTimestamp, type Timestamp } from "firebase/firestore";

export type FirestoreTimestamp = Timestamp | null | undefined;

export function timestampToIso(value: FirestoreTimestamp): string {
  if (!value) {
    return new Date().toISOString();
  }

  return value.toDate().toISOString();
}

export function buildServerTimestampFields(isCreate: boolean) {
  if (isCreate) {
    return {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  }

  return {
    updatedAt: serverTimestamp(),
  };
}
