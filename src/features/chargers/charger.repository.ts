import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { buildServerTimestampFields, timestampToIso } from "../shared/firestore-utils";
import type {
  Charger,
  ChargerFilter,
  ChargerStatus,
  UpsertChargerInput,
} from "./charger.types";
import {
  DEV_PREVIEW_MODE,
  DEV_PREVIEW_STATE,
  isFirebasePermissionError,
  logDevPreviewFallback,
} from "../shared/dev-preview";

interface ChargerDoc {
  hostUserId: string;
  name: string;
  address: string;
  suburb: string;
  state: string;
  latitude: number;
  longitude: number;
  maxPowerKw: number;
  pricingPerKwh: number;
  connectors: Charger["connectors"];
  amenities: string[];
  availabilityNote: string;
  availabilityWindow?: Charger["availabilityWindow"];
  status: ChargerStatus;
  verificationScore: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function mapCharger(id: string, docData: ChargerDoc): Charger {
  return {
    id,
    hostUserId: docData.hostUserId,
    name: docData.name,
    address: docData.address,
    suburb: docData.suburb,
    state: docData.state,
    latitude: docData.latitude,
    longitude: docData.longitude,
    maxPowerKw: docData.maxPowerKw,
    pricingPerKwh: docData.pricingPerKwh,
    connectors: docData.connectors,
    amenities: docData.amenities,
    availabilityNote: docData.availabilityNote,
    availabilityWindow: docData.availabilityWindow,
    status: docData.status,
    verificationScore: docData.verificationScore,
    createdAtIso: timestampToIso(docData.createdAt),
    updatedAtIso: timestampToIso(docData.updatedAt),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function filterChargers(chargers: Charger[], filter?: ChargerFilter): Charger[] {
  if (!filter) {
    return chargers;
  }

  return chargers.filter((charger) => {
    if (filter.status && charger.status !== filter.status) {
      return false;
    }

    if (filter.state && charger.state.toLowerCase() !== filter.state.toLowerCase()) {
      return false;
    }

    if (typeof filter.minPowerKw === "number" && charger.maxPowerKw < filter.minPowerKw) {
      return false;
    }

    if (
      filter.connectorType &&
      !charger.connectors.some((connector) => connector.type === filter.connectorType)
    ) {
      return false;
    }

    if (filter.searchText) {
      const haystack = `${charger.name} ${charger.address} ${charger.suburb}`.toLowerCase();
      if (!haystack.includes(filter.searchText.trim().toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

function getDevChargers(filter?: ChargerFilter): Charger[] {
  return filterChargers(DEV_PREVIEW_STATE.chargers, filter);
}

export async function upsertCharger(
  chargerId: string,
  hostUserId: string,
  payload: UpsertChargerInput,
  status: ChargerStatus = "pending_verification"
): Promise<void> {
  const ref = doc(db, "chargers", chargerId);

  try {
    await setDoc(
      ref,
      {
        hostUserId,
        ...payload,
        status,
        verificationScore: status === "verified" ? 90 : 50,
        ...buildServerTimestampFields(true),
      },
      { merge: true }
    );
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("chargers.upsertCharger", error);
    const existingIndex = DEV_PREVIEW_STATE.chargers.findIndex((charger) => charger.id === chargerId);
    const next: Charger = {
      id: chargerId,
      hostUserId,
      ...payload,
      status,
      verificationScore: status === "verified" ? 90 : 50,
      createdAtIso: DEV_PREVIEW_STATE.chargers[existingIndex]?.createdAtIso || new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      DEV_PREVIEW_STATE.chargers[existingIndex] = next;
    } else {
      DEV_PREVIEW_STATE.chargers.push(next);
    }
  }
}

export async function getChargerById(chargerId: string): Promise<Charger | null> {
  try {
    const snapshot = await getDoc(doc(db, "chargers", chargerId));

    if (!snapshot.exists()) {
      return null;
    }

    return mapCharger(snapshot.id, snapshot.data() as ChargerDoc);
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("chargers.getChargerById", error);
    return DEV_PREVIEW_STATE.chargers.find((charger) => charger.id === chargerId) || null;
  }
}

export async function listChargers(filter?: ChargerFilter): Promise<Charger[]> {
  const q = query(collection(db, "chargers"), orderBy("updatedAt", "desc"));

  try {
    const snapshot = await getDocs(q);

    return filterChargers(
      snapshot.docs.map((charger) => mapCharger(charger.id, charger.data() as ChargerDoc)),
      filter
    );
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("chargers.listChargers", error);
    return getDevChargers(filter);
  }
}

export async function listChargersByHost(hostUserId: string): Promise<Charger[]> {
  const q = query(
    collection(db, "chargers"),
    where("hostUserId", "==", hostUserId),
    orderBy("updatedAt", "desc")
  );

  try {
    const snapshot = await getDocs(q);

    return snapshot.docs.map((charger) => mapCharger(charger.id, charger.data() as ChargerDoc));
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("chargers.listChargersByHost", error);
    return DEV_PREVIEW_STATE.chargers.filter((charger) => charger.hostUserId === hostUserId);
  }
}

export function listenToChargers(
  callback: (chargers: Charger[]) => void,
  filter?: ChargerFilter,
  onError?: (message: string) => void
): () => void {
  const q = query(collection(db, "chargers"), orderBy("updatedAt", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(
        filterChargers(
          snapshot.docs.map((charger) => mapCharger(charger.id, charger.data() as ChargerDoc)),
          filter
        )
      );
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        onError?.(errorMessage(error, "Unable to listen for chargers."));
        return;
      }

      logDevPreviewFallback("chargers.listenToChargers", error);
      callback(getDevChargers(filter));
      unsubscribe();
    }
  );

  return unsubscribe;
}

export function listenToHostChargers(
  hostUserId: string,
  callback: (chargers: Charger[]) => void,
  onError?: (message: string) => void
): () => void {
  const q = query(
    collection(db, "chargers"),
    where("hostUserId", "==", hostUserId),
    orderBy("updatedAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((charger) => mapCharger(charger.id, charger.data() as ChargerDoc))
      );
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        onError?.(errorMessage(error, "Unable to listen for host chargers."));
        return;
      }

      logDevPreviewFallback("chargers.listenToHostChargers", error);
      callback(DEV_PREVIEW_STATE.chargers.filter((charger) => charger.hostUserId === hostUserId));
      unsubscribe();
    }
  );

  return unsubscribe;
}

export async function updateChargerStatus(
  chargerId: string,
  status: ChargerStatus,
  verificationScore: number
): Promise<void> {
  try {
    await updateDoc(doc(db, "chargers", chargerId), {
      status,
      verificationScore,
      ...buildServerTimestampFields(false),
    });
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("chargers.updateChargerStatus", error);
    DEV_PREVIEW_STATE.chargers = DEV_PREVIEW_STATE.chargers.map((charger) =>
      charger.id === chargerId
        ? { ...charger, status, verificationScore, updatedAtIso: new Date().toISOString() }
        : charger
    );
  }
}
