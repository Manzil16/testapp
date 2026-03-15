import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { buildServerTimestampFields, timestampToIso } from "../shared/firestore-utils";
import type {
  AppNotification,
  CreateNotificationInput,
} from "./notification.types";
import {
  DEV_PREVIEW_MODE,
  DEV_PREVIEW_STATE,
  createDevId,
  isFirebasePermissionError,
  logDevPreviewFallback,
} from "../shared/dev-preview";

interface NotificationDoc {
  userId: string;
  title: string;
  body: string;
  type: AppNotification["type"];
  isRead: boolean;
  metadata?: Record<string, string>;
  createdAt?: Timestamp;
}

function mapNotification(id: string, docData: NotificationDoc): AppNotification {
  return {
    id,
    userId: docData.userId,
    title: docData.title,
    body: docData.body,
    type: docData.type,
    isRead: docData.isRead,
    metadata: docData.metadata,
    createdAtIso: timestampToIso(docData.createdAt),
  };
}

function listDevNotificationsByUser(userId: string): AppNotification[] {
  return DEV_PREVIEW_STATE.notifications.filter((item) => item.userId === userId);
}

export async function createNotification(input: CreateNotificationInput): Promise<string> {
  try {
    const ref = await addDoc(collection(db, "notifications"), {
      ...input,
      isRead: false,
      ...buildServerTimestampFields(true),
    });

    return ref.id;
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("notifications.createNotification", error);
    const id = createDevId("dev-note");
    DEV_PREVIEW_STATE.notifications.push({
      id,
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      isRead: false,
      metadata: input.metadata,
      createdAtIso: new Date().toISOString(),
    });
    return id;
  }
}

export async function listNotificationsByUser(userId: string): Promise<AppNotification[]> {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => mapNotification(item.id, item.data() as NotificationDoc));
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("notifications.listNotificationsByUser", error);
    return listDevNotificationsByUser(userId);
  }
}

export function listenToNotificationsByUser(
  userId: string,
  callback: (items: AppNotification[]) => void
): () => void {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((item) => mapNotification(item.id, item.data() as NotificationDoc)));
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        callback([]);
        return;
      }

      logDevPreviewFallback("notifications.listenToNotificationsByUser", error);
      callback(listDevNotificationsByUser(userId));
      unsubscribe();
    }
  );

  return unsubscribe;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      isRead: true,
      ...buildServerTimestampFields(false),
    });
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("notifications.markNotificationRead", error);
    DEV_PREVIEW_STATE.notifications = DEV_PREVIEW_STATE.notifications.map((item) =>
      item.id === notificationId ? { ...item, isRead: true } : item
    );
  }
}
