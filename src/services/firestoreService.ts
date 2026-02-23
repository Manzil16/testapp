import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebaseConfig";

/* ---------------- TYPES ---------------- */

export interface Connector {
  type: string;
  powerKW: number;
}

export interface Charger {
  id?: string;
  name: string;
  networkType: string;
  latitude: number;
  longitude: number;
  speedCategory: string;
  isCommunityCharger: boolean;
  connectors: Connector[];
}

export interface ChargerReport {
  chargerId: string;
  userId: string;
  status: string;
  timestamp?: any;
}

/* ---------------- READ ---------------- */

export const listenToChargers = (callback: (data: Charger[]) => void) => {
  return onSnapshot(collection(db, "chargers"), (snapshot) => {
    const chargers: Charger[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Charger, "id">)
    }));
    callback(chargers);
  });
};

/* ---------------- CREATE ---------------- */

export const addCharger = async (charger: Charger) => {
  await addDoc(collection(db, "chargers"), {
    name: charger.name,
    networkType: charger.networkType.toLowerCase(),
    latitude: Number(charger.latitude),
    longitude: Number(charger.longitude),
    speedCategory: charger.speedCategory,
    isCommunityCharger: Boolean(charger.isCommunityCharger),
    connectors: charger.connectors.map((c) => ({
      type: c.type,
      powerKW: Number(c.powerKW)
    }))
  });
};

/* ---------------- UPDATE ---------------- */

export const updateCharger = async (id: string, charger: Charger) => {
  await updateDoc(doc(db, "chargers", id), {
    name: charger.name,
    networkType: charger.networkType.toLowerCase(),
    latitude: Number(charger.latitude),
    longitude: Number(charger.longitude),
    speedCategory: charger.speedCategory,
    isCommunityCharger: Boolean(charger.isCommunityCharger),
    connectors: charger.connectors.map((c) => ({
      type: c.type,
      powerKW: Number(c.powerKW)
    }))
  });
};

/* ---------------- DELETE ---------------- */

export const deleteCharger = async (id: string) => {
  await deleteDoc(doc(db, "chargers", id));
};

/* ---------------- REPORT ---------------- */

export const addChargerReport = async (report: ChargerReport) => {
  await addDoc(collection(db, "chargerReports"), {
    chargerId: report.chargerId,
    userId: report.userId,
    status: report.status,
    timestamp: serverTimestamp()
  });
};