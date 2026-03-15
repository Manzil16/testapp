import {
  addDoc,
  collection,
  doc,
  getDoc,
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
import type { Booking, BookingStatus, CreateBookingInput } from "./booking.types";
import type { AvailabilityDay, ChargerAvailabilityWindow } from "../chargers/charger.types";
import {
  DEV_PREVIEW_MODE,
  DEV_PREVIEW_STATE,
  createDevId,
  isFirebasePermissionError,
  logDevPreviewFallback,
} from "../shared/dev-preview";

const BOOKING_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface BookingDoc {
  chargerId: string;
  driverUserId: string;
  hostUserId: string;
  startTimeIso: string;
  endTimeIso: string;
  estimatedKWh: number;
  note: string;
  status: BookingStatus;
  arrivalSignal: Booking["arrivalSignal"];
  expiresAtIso?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface ChargerAvailabilityDoc {
  hostUserId?: string;
  availabilityWindow?: ChargerAvailabilityWindow;
  availabilityNote?: string;
}

function mapBooking(id: string, docData: BookingDoc): Booking {
  const createdAtIso = timestampToIso(docData.createdAt);

  // Auto-expire: if booking is still "requested" and past its expiry, treat as expired
  let effectiveStatus = docData.status;
  if (effectiveStatus === "requested") {
    const expiresAt = docData.expiresAtIso
      ? new Date(docData.expiresAtIso).getTime()
      : new Date(createdAtIso).getTime() + BOOKING_EXPIRY_MS;
    if (Date.now() > expiresAt) {
      effectiveStatus = "cancelled";
    }
  }

  return {
    id,
    chargerId: docData.chargerId,
    driverUserId: docData.driverUserId,
    hostUserId: docData.hostUserId,
    startTimeIso: docData.startTimeIso,
    endTimeIso: docData.endTimeIso,
    estimatedKWh: docData.estimatedKWh,
    note: effectiveStatus !== docData.status ? "Expired — host did not respond" : docData.note,
    status: effectiveStatus,
    arrivalSignal: docData.arrivalSignal,
    expiresAtIso: docData.expiresAtIso,
    createdAtIso,
    updatedAtIso: timestampToIso(docData.updatedAt),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function parseTimeToMinutes(value: string): number | null {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function parseAvailabilityFromNote(note?: string): ChargerAvailabilityWindow | undefined {
  if (!note) {
    return undefined;
  }

  const timeMatch = note.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  if (!timeMatch) {
    return undefined;
  }

  const dayMatches = note.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g) || [];
  const uniqueDays = Array.from(new Set(dayMatches)) as AvailabilityDay[];
  if (!uniqueDays.length) {
    return undefined;
  }

  return {
    days: uniqueDays,
    startTime: timeMatch[1],
    endTime: timeMatch[2],
  };
}

const weekdayByIndex: ChargerAvailabilityWindow["days"] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function isInstantWithinWindow(date: Date, availabilityWindow: ChargerAvailabilityWindow): boolean {
  const dayKey = weekdayByIndex[date.getDay()];
  if (!availabilityWindow.days.includes(dayKey)) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(availabilityWindow.startTime);
  const endMinutes = parseTimeToMinutes(availabilityWindow.endTime);
  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  // Overnight windows (e.g., 22:00-06:00)
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function ensureBookingWithinAvailability(
  startDate: Date,
  endDate: Date,
  availabilityWindow?: ChargerAvailabilityWindow
) {
  if (!availabilityWindow) {
    return;
  }

  if (!isInstantWithinWindow(startDate, availabilityWindow)) {
    throw new Error("Selected start time is outside host availability.");
  }

  if (!isInstantWithinWindow(endDate, availabilityWindow)) {
    throw new Error("Selected end time is outside host availability.");
  }
}

async function validateBookingRequest(input: CreateBookingInput): Promise<void> {
  const startDate = new Date(input.startTimeIso);
  const endDate = new Date(input.endTimeIso);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate.getTime() <= startDate.getTime()
  ) {
    throw new Error("Booking time range is invalid.");
  }

  const chargerSnapshot = await getDoc(doc(db, "chargers", input.chargerId));
  if (!chargerSnapshot.exists()) {
    throw new Error("Selected charger could not be found.");
  }

  const chargerData = chargerSnapshot.data() as ChargerAvailabilityDoc;
  if (chargerData.hostUserId && chargerData.hostUserId !== input.hostUserId) {
    throw new Error("Booking host does not match charger host.");
  }

  ensureBookingWithinAvailability(
    startDate,
    endDate,
    chargerData.availabilityWindow || parseAvailabilityFromNote(chargerData.availabilityNote)
  );
}

function listDevBookingsByDriver(driverUserId: string): Booking[] {
  return DEV_PREVIEW_STATE.bookings.filter((booking) => booking.driverUserId === driverUserId);
}

function listDevBookingsByHost(hostUserId: string): Booking[] {
  return DEV_PREVIEW_STATE.bookings.filter((booking) => booking.hostUserId === hostUserId);
}

export async function createBookingRequest(input: CreateBookingInput): Promise<string> {
  try {
    await validateBookingRequest(input);

    const expiresAtIso = new Date(Date.now() + BOOKING_EXPIRY_MS).toISOString();

    const ref = await addDoc(collection(db, "bookings"), {
      ...input,
      note: input.note || "",
      status: "requested",
      arrivalSignal: "en_route",
      expiresAtIso,
      ...buildServerTimestampFields(true),
    });

    return ref.id;
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("bookings.createBookingRequest", error);
    const id = createDevId("dev-booking");
    DEV_PREVIEW_STATE.bookings.push({
      id,
      chargerId: input.chargerId,
      driverUserId: input.driverUserId,
      hostUserId: input.hostUserId,
      startTimeIso: input.startTimeIso,
      endTimeIso: input.endTimeIso,
      estimatedKWh: input.estimatedKWh,
      note: input.note || "",
      status: "requested",
      arrivalSignal: "en_route",
      expiresAtIso: new Date(Date.now() + BOOKING_EXPIRY_MS).toISOString(),
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    });

    return id;
  }
}

export async function listBookingsByDriver(driverUserId: string): Promise<Booking[]> {
  const q = query(
    collection(db, "bookings"),
    where("driverUserId", "==", driverUserId),
    orderBy("updatedAt", "desc")
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((booking) => mapBooking(booking.id, booking.data() as BookingDoc));
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("bookings.listBookingsByDriver", error);
    return listDevBookingsByDriver(driverUserId);
  }
}

export async function listBookingsByHost(hostUserId: string): Promise<Booking[]> {
  const q = query(
    collection(db, "bookings"),
    where("hostUserId", "==", hostUserId),
    orderBy("updatedAt", "desc")
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((booking) => mapBooking(booking.id, booking.data() as BookingDoc));
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("bookings.listBookingsByHost", error);
    return listDevBookingsByHost(hostUserId);
  }
}

export function listenToBookingsByDriver(
  driverUserId: string,
  callback: (bookings: Booking[]) => void,
  onError?: (message: string) => void
): () => void {
  const q = query(
    collection(db, "bookings"),
    where("driverUserId", "==", driverUserId),
    orderBy("updatedAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((booking) => mapBooking(booking.id, booking.data() as BookingDoc)));
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        onError?.(errorMessage(error, "Unable to listen for driver bookings."));
        return;
      }

      logDevPreviewFallback("bookings.listenToBookingsByDriver", error);
      callback(listDevBookingsByDriver(driverUserId));
      unsubscribe();
    }
  );

  return unsubscribe;
}

export function listenToBookingsByHost(
  hostUserId: string,
  callback: (bookings: Booking[]) => void,
  onError?: (message: string) => void
): () => void {
  const q = query(
    collection(db, "bookings"),
    where("hostUserId", "==", hostUserId),
    orderBy("updatedAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((booking) => mapBooking(booking.id, booking.data() as BookingDoc)));
    },
    (error) => {
      if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
        onError?.(errorMessage(error, "Unable to listen for host bookings."));
        return;
      }

      logDevPreviewFallback("bookings.listenToBookingsByHost", error);
      callback(listDevBookingsByHost(hostUserId));
      unsubscribe();
    }
  );

  return unsubscribe;
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  note?: string
): Promise<void> {
  try {
    await updateDoc(doc(db, "bookings", bookingId), {
      status,
      note: note ?? "",
      ...buildServerTimestampFields(false),
    });
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("bookings.updateBookingStatus", error);
    DEV_PREVIEW_STATE.bookings = DEV_PREVIEW_STATE.bookings.map((booking) =>
      booking.id === bookingId
        ? {
            ...booking,
            status,
            note: note ?? "",
            updatedAtIso: new Date().toISOString(),
          }
        : booking
    );
  }
}

export async function updateArrivalSignal(
  bookingId: string,
  signal: Booking["arrivalSignal"]
): Promise<void> {
  try {
    await updateDoc(doc(db, "bookings", bookingId), {
      arrivalSignal: signal,
      ...buildServerTimestampFields(false),
    });
  } catch (error) {
    if (!DEV_PREVIEW_MODE || !isFirebasePermissionError(error)) {
      throw error;
    }

    logDevPreviewFallback("bookings.updateArrivalSignal", error);
    DEV_PREVIEW_STATE.bookings = DEV_PREVIEW_STATE.bookings.map((booking) =>
      booking.id === bookingId
        ? {
            ...booking,
            arrivalSignal: signal,
            updatedAtIso: new Date().toISOString(),
          }
        : booking
    );
  }
}
