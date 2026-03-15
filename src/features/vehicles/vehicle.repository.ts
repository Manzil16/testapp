import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { buildServerTimestampFields, timestampToIso } from "../shared/firestore-utils";
import type { UpsertVehicleInput, Vehicle } from "./vehicle.types";
import {
  DEV_PREVIEW_MODE,
  DEV_PREVIEW_STATE,
  isFirebasePermissionError,
  logDevPreviewFallback,
} from "../shared/dev-preview";

interface VehicleDoc {
  userId: string;
  name: string;
  make: string;
  model: string;
  year: number;
  batteryCapacityKWh: number;
  maxRangeKm: number;
  efficiencyKWhPer100Km: number;
  defaultReservePercent: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function mapVehicle(id: string, docData: VehicleDoc): Vehicle {
  return {
    id,
    userId: docData.userId,
    name: docData.name,
    make: docData.make,
    model: docData.model,
    year: docData.year,
    batteryCapacityKWh: docData.batteryCapacityKWh,
    maxRangeKm: docData.maxRangeKm,
    efficiencyKWhPer100Km: docData.efficiencyKWhPer100Km,
    defaultReservePercent: docData.defaultReservePercent,
    createdAtIso: timestampToIso(docData.createdAt),
    updatedAtIso: timestampToIso(docData.updatedAt),
  };
}

function getDevVehiclesByUser(userId: string): Vehicle[] {
  return DEV_PREVIEW_STATE.vehicles.filter((vehicle) => vehicle.userId === userId);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export async function upsertVehicle(
  vehicleId: string,
  userId: string,
  payload: UpsertVehicleInput
): Promise<void> {
  const ref = doc(db, "vehicles", vehicleId);

  try {
    await setDoc(
      ref,
      {
        userId,
        ...payload,
        ...buildServerTimestampFields(true),
      },
      { merge: true }
    );
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("vehicles.upsertVehicle", error);
    const existingIndex = DEV_PREVIEW_STATE.vehicles.findIndex((vehicle) => vehicle.id === vehicleId);
    const next: Vehicle = {
      id: vehicleId,
      userId,
      ...payload,
      createdAtIso: DEV_PREVIEW_STATE.vehicles[existingIndex]?.createdAtIso || new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      DEV_PREVIEW_STATE.vehicles[existingIndex] = next;
    } else {
      DEV_PREVIEW_STATE.vehicles.push(next);
    }
  }
}

export async function listVehiclesByUser(userId: string): Promise<Vehicle[]> {
  const q = query(
    collection(db, "vehicles"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  try {
    const snapshot = await getDocs(q);

    return snapshot.docs.map((vehicle) =>
      mapVehicle(vehicle.id, vehicle.data() as VehicleDoc)
    );
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("vehicles.listVehiclesByUser", error);
    return getDevVehiclesByUser(userId);
  }
}

export function listenToVehiclesByUser(
  userId: string,
  callback: (vehicles: Vehicle[]) => void,
  onError?: (message: string) => void
): () => void {
  const q = query(
    collection(db, "vehicles"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((vehicle) => mapVehicle(vehicle.id, vehicle.data() as VehicleDoc))
      );
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        onError?.(errorMessage(error, "Unable to listen for vehicles."));
        return;
      }

      logDevPreviewFallback("vehicles.listenToVehiclesByUser", error);
      callback(getDevVehiclesByUser(userId));
      unsubscribe();
    }
  );

  return unsubscribe;
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "vehicles", vehicleId));
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("vehicles.deleteVehicle", error);
    DEV_PREVIEW_STATE.vehicles = DEV_PREVIEW_STATE.vehicles.filter(
      (vehicle) => vehicle.id !== vehicleId
    );
  }
}
