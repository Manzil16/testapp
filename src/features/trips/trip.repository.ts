import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { buildServerTimestampFields, timestampToIso } from "../shared/firestore-utils";
import type { CreateTripInput, Trip } from "./trip.types";
import {
  DEV_PREVIEW_MODE,
  DEV_PREVIEW_STATE,
  createDevId,
  isFirebasePermissionError,
  logDevPreviewFallback,
} from "../shared/dev-preview";

interface TripDoc {
  userId: string;
  origin: Trip["origin"];
  destination: Trip["destination"];
  currentBatteryPercent: number;
  vehicleMaxRangeKm: number;
  distanceKm: number;
  durationMinutes: number;
  routePolyline: string;
  projectedArrivalPercent: number;
  recommendedChargerId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function mapTrip(id: string, data: TripDoc): Trip {
  return {
    id,
    userId: data.userId,
    origin: data.origin,
    destination: data.destination,
    currentBatteryPercent: data.currentBatteryPercent,
    vehicleMaxRangeKm: data.vehicleMaxRangeKm,
    distanceKm: data.distanceKm,
    durationMinutes: data.durationMinutes,
    routePolyline: data.routePolyline,
    projectedArrivalPercent: data.projectedArrivalPercent,
    recommendedChargerId: data.recommendedChargerId,
    createdAtIso: timestampToIso(data.createdAt),
    updatedAtIso: timestampToIso(data.updatedAt),
  };
}

function listDevTripsByUser(userId: string): Trip[] {
  return DEV_PREVIEW_STATE.trips.filter((trip) => trip.userId === userId);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export async function createTrip(input: CreateTripInput): Promise<string> {
  try {
    const {
      recommendedChargerId,
      ...requiredFields
    } = input;

    const firestoreData: Record<string, unknown> = {
      ...requiredFields,
      ...buildServerTimestampFields(true),
    };

    if (recommendedChargerId != null) {
      firestoreData.recommendedChargerId = recommendedChargerId;
    }

    const ref = await addDoc(collection(db, "trips"), firestoreData);

    return ref.id;
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("trips.createTrip", error);
    const id = createDevId("dev-trip");
    DEV_PREVIEW_STATE.trips.push({
      id,
      ...input,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    });
    return id;
  }
}

export async function getTripById(tripId: string): Promise<Trip | null> {
  try {
    const snapshot = await getDoc(doc(db, "trips", tripId));
    if (!snapshot.exists()) {
      return null;
    }

    return mapTrip(snapshot.id, snapshot.data() as TripDoc);
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("trips.getTripById", error);
    return DEV_PREVIEW_STATE.trips.find((trip) => trip.id === tripId) || null;
  }
}

export async function listTripsByUser(userId: string): Promise<Trip[]> {
  const q = query(
    collection(db, "trips"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((trip) => mapTrip(trip.id, trip.data() as TripDoc));
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("trips.listTripsByUser", error);
    return listDevTripsByUser(userId);
  }
}

export function listenToTripsByUser(
  userId: string,
  callback: (trips: Trip[]) => void,
  onError?: (message: string) => void
): () => void {
  const q = query(
    collection(db, "trips"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((trip) => mapTrip(trip.id, trip.data() as TripDoc)));
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        onError?.(errorMessage(error, "Unable to listen for trips."));
        return;
      }

      logDevPreviewFallback("trips.listenToTripsByUser", error);
      callback(listDevTripsByUser(userId));
      unsubscribe();
    }
  );

  return unsubscribe;
}
