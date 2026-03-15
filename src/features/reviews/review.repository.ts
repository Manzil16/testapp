import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { buildServerTimestampFields, timestampToIso } from "../shared/firestore-utils";
import type { CreateReviewInput, Review } from "./review.types";
import {
  DEV_PREVIEW_MODE,
  DEV_PREVIEW_STATE,
  createDevId,
  isFirebasePermissionError,
  logDevPreviewFallback,
} from "../shared/dev-preview";

interface ReviewDoc {
  bookingId: string;
  chargerId: string;
  driverUserId: string;
  hostUserId: string;
  rating: number;
  comment: string;
  createdAt?: Timestamp;
}

function mapReview(id: string, docData: ReviewDoc): Review {
  return {
    id,
    bookingId: docData.bookingId,
    chargerId: docData.chargerId,
    driverUserId: docData.driverUserId,
    hostUserId: docData.hostUserId,
    rating: docData.rating,
    comment: docData.comment,
    createdAtIso: timestampToIso(docData.createdAt),
  };
}

function listDevReviewsByCharger(chargerId: string): Review[] {
  return DEV_PREVIEW_STATE.reviews.filter((review) => review.chargerId === chargerId);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export async function createReview(input: CreateReviewInput): Promise<string> {
  try {
    const ref = await addDoc(collection(db, "reviews"), {
      ...input,
      comment: input.comment || "",
      ...buildServerTimestampFields(true),
    });

    return ref.id;
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("reviews.createReview", error);
    const id = createDevId("dev-review");
    DEV_PREVIEW_STATE.reviews.push({
      id,
      bookingId: input.bookingId,
      chargerId: input.chargerId,
      driverUserId: input.driverUserId,
      hostUserId: input.hostUserId,
      rating: input.rating,
      comment: input.comment || "",
      createdAtIso: new Date().toISOString(),
    });

    return id;
  }
}

export async function listReviewsByCharger(chargerId: string): Promise<Review[]> {
  const q = query(
    collection(db, "reviews"),
    where("chargerId", "==", chargerId),
    orderBy("createdAt", "desc")
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((review) => mapReview(review.id, review.data() as ReviewDoc));
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("reviews.listReviewsByCharger", error);
    return listDevReviewsByCharger(chargerId);
  }
}

export function listenToReviewsByCharger(
  chargerId: string,
  callback: (reviews: Review[]) => void,
  onError?: (message: string) => void
): () => void {
  const q = query(
    collection(db, "reviews"),
    where("chargerId", "==", chargerId),
    orderBy("createdAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((review) => mapReview(review.id, review.data() as ReviewDoc)));
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        onError?.(errorMessage(error, "Unable to listen for reviews."));
        return;
      }

      logDevPreviewFallback("reviews.listenToReviewsByCharger", error);
      callback(listDevReviewsByCharger(chargerId));
      unsubscribe();
    }
  );

  return unsubscribe;
}
