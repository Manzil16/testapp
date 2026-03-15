import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  doc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { buildServerTimestampFields, timestampToIso } from "../shared/firestore-utils";
import type {
  CreateVerificationRequestInput,
  VerificationRequest,
  VerificationStatus,
} from "./verification.types";
import {
  DEV_PREVIEW_MODE,
  DEV_PREVIEW_STATE,
  createDevId,
  isFirebasePermissionError,
  logDevPreviewFallback,
} from "../shared/dev-preview";

interface VerificationRequestDoc {
  chargerId: string;
  hostUserId: string;
  status: VerificationStatus;
  note: string;
  reviewedByUserId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function mapRequest(id: string, data: VerificationRequestDoc): VerificationRequest {
  return {
    id,
    chargerId: data.chargerId,
    hostUserId: data.hostUserId,
    status: data.status,
    note: data.note,
    reviewedByUserId: data.reviewedByUserId,
    createdAtIso: timestampToIso(data.createdAt),
    updatedAtIso: timestampToIso(data.updatedAt),
  };
}

function listDevVerificationQueue(): VerificationRequest[] {
  return DEV_PREVIEW_STATE.verificationRequests.filter((item) => item.status === "pending");
}

export async function createVerificationRequest(
  input: CreateVerificationRequestInput
): Promise<string> {
  try {
    const ref = await addDoc(collection(db, "verificationRequests"), {
      chargerId: input.chargerId,
      hostUserId: input.hostUserId,
      note: input.note || "",
      status: "pending",
      ...buildServerTimestampFields(true),
    });

    return ref.id;
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("verification.createVerificationRequest", error);
    const id = createDevId("dev-verification");
    DEV_PREVIEW_STATE.verificationRequests.push({
      id,
      chargerId: input.chargerId,
      hostUserId: input.hostUserId,
      status: "pending",
      note: input.note || "",
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    });
    return id;
  }
}

export async function listVerificationQueue(): Promise<VerificationRequest[]> {
  const q = query(
    collection(db, "verificationRequests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc")
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => mapRequest(item.id, item.data() as VerificationRequestDoc));
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("verification.listVerificationQueue", error);
    return listDevVerificationQueue();
  }
}

export function listenToVerificationQueue(
  callback: (items: VerificationRequest[]) => void
): () => void {
  const q = query(
    collection(db, "verificationRequests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((item) => mapRequest(item.id, item.data() as VerificationRequestDoc)));
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        callback([]);
        return;
      }

      logDevPreviewFallback("verification.listenToVerificationQueue", error);
      callback(listDevVerificationQueue());
      unsubscribe();
    }
  );

  return unsubscribe;
}

export async function listVerificationRequestsByHost(
  hostUserId: string
): Promise<VerificationRequest[]> {
  const q = query(
    collection(db, "verificationRequests"),
    where("hostUserId", "==", hostUserId),
    orderBy("updatedAt", "desc")
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => mapRequest(item.id, item.data() as VerificationRequestDoc));
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("verification.listVerificationRequestsByHost", error);
    return DEV_PREVIEW_STATE.verificationRequests.filter((item) => item.hostUserId === hostUserId);
  }
}

export async function reviewVerificationRequest(input: {
  requestId: string;
  reviewerUserId: string;
  status: VerificationStatus;
  note: string;
}) {
  try {
    await updateDoc(doc(db, "verificationRequests", input.requestId), {
      status: input.status,
      note: input.note,
      reviewedByUserId: input.reviewerUserId,
      ...buildServerTimestampFields(false),
    });
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("verification.reviewVerificationRequest", error);
    DEV_PREVIEW_STATE.verificationRequests = DEV_PREVIEW_STATE.verificationRequests.map((item) =>
      item.id === input.requestId
        ? {
            ...item,
            status: input.status,
            note: input.note,
            reviewedByUserId: input.reviewerUserId,
            updatedAtIso: new Date().toISOString(),
          }
        : item
    );
  }
}
