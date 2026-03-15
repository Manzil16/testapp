import type { AppNotification } from "../notifications";
import type { Booking } from "../bookings";
import type { Charger } from "../chargers";
import type { Review } from "../reviews";
import type { Trip } from "../trips";
import type { UserProfile } from "../users";
import type { Vehicle } from "../vehicles";
import type { VerificationRequest } from "../verification";

const previewModeEnv = String(process.env.EXPO_PUBLIC_DEV_PREVIEW_MODE || "").toLowerCase();

export const DEV_PREVIEW_MODE =
  __DEV__ && (previewModeEnv === "1" || previewModeEnv === "true" || previewModeEnv === "yes");

export const DEV_PREVIEW_SESSION_USER = {
  uid: "dev-preview-user",
  email: "dev.preview@vehiclegrid.local",
  displayName: "Dev Preview User",
};

function nowIso() {
  return new Date().toISOString();
}

const devProfile: UserProfile = {
  id: DEV_PREVIEW_SESSION_USER.uid,
  email: DEV_PREVIEW_SESSION_USER.email,
  displayName: DEV_PREVIEW_SESSION_USER.displayName,
  role: "driver",
  phone: "+61 400 000 000",
  preferredReservePercent: 12,
  createdAtIso: nowIso(),
  updatedAtIso: nowIso(),
};

const devChargerA: Charger = {
  id: "dev-charger-cbd",
  hostUserId: DEV_PREVIEW_SESSION_USER.uid,
  name: "Preview Sydney CBD Charger",
  address: "388 George St, Sydney NSW 2000",
  suburb: "Sydney",
  state: "NSW",
  latitude: -33.8697,
  longitude: 151.207,
  maxPowerKw: 180,
  pricingPerKwh: 0.59,
  connectors: [
    { type: "CCS2", powerKw: 180, count: 2 },
    { type: "Type2", powerKw: 22, count: 1 },
  ],
  amenities: ["Cafe", "Toilets", "CCTV"],
  availabilityNote: "24/7",
  status: "verified",
  verificationScore: 88,
  createdAtIso: nowIso(),
  updatedAtIso: nowIso(),
};

const devChargerB: Charger = {
  id: "dev-charger-penrith",
  hostUserId: "preview-host-2",
  name: "Preview Penrith M4 Fast Hub",
  address: "Mulgoa Rd, Penrith NSW 2750",
  suburb: "Penrith",
  state: "NSW",
  latitude: -33.7511,
  longitude: 150.6942,
  maxPowerKw: 150,
  pricingPerKwh: 0.55,
  connectors: [{ type: "CCS2", powerKw: 150, count: 3 }],
  amenities: ["Restrooms", "Food Court"],
  availabilityNote: "06:00-23:00",
  status: "verified",
  verificationScore: 82,
  createdAtIso: nowIso(),
  updatedAtIso: nowIso(),
};

export const DEV_PREVIEW_STATE: {
  profiles: Record<string, UserProfile>;
  vehicles: Vehicle[];
  chargers: Charger[];
  bookings: Booking[];
  reviews: Review[];
  notifications: AppNotification[];
  verificationRequests: VerificationRequest[];
  trips: Trip[];
} = {
  profiles: {
    [devProfile.id]: devProfile,
  },
  vehicles: [
    {
      id: "dev-vehicle-1",
      userId: DEV_PREVIEW_SESSION_USER.uid,
      name: "Preview Tesla Model Y",
      make: "Tesla",
      model: "Model Y",
      year: 2024,
      batteryCapacityKWh: 75,
      maxRangeKm: 500,
      efficiencyKWhPer100Km: 15.5,
      defaultReservePercent: 12,
      createdAtIso: nowIso(),
      updatedAtIso: nowIso(),
    },
  ],
  chargers: [devChargerA, devChargerB],
  bookings: [
    {
      id: "dev-booking-1",
      chargerId: devChargerA.id,
      driverUserId: DEV_PREVIEW_SESSION_USER.uid,
      hostUserId: devChargerA.hostUserId,
      startTimeIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      endTimeIso: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      estimatedKWh: 28,
      note: "Preview booking request",
      status: "approved",
      arrivalSignal: "en_route",
      createdAtIso: nowIso(),
      updatedAtIso: nowIso(),
    },
    {
      id: "dev-booking-2",
      chargerId: devChargerA.id,
      driverUserId: "preview-driver-2",
      hostUserId: DEV_PREVIEW_SESSION_USER.uid,
      startTimeIso: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      endTimeIso: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      estimatedKWh: 35,
      note: "Incoming host-side request",
      status: "requested",
      arrivalSignal: "en_route",
      createdAtIso: nowIso(),
      updatedAtIso: nowIso(),
    },
  ],
  reviews: [
    {
      id: "dev-review-1",
      bookingId: "dev-booking-1",
      chargerId: devChargerA.id,
      driverUserId: DEV_PREVIEW_SESSION_USER.uid,
      hostUserId: devChargerA.hostUserId,
      rating: 4.7,
      comment: "Fast and reliable for preview flow.",
      createdAtIso: nowIso(),
    },
  ],
  notifications: [
    {
      id: "dev-note-1",
      userId: DEV_PREVIEW_SESSION_USER.uid,
      title: "Preview mode active",
      body: "Data is running in temporary in-memory fallback mode.",
      type: "system",
      isRead: false,
      metadata: { mode: "dev-preview" },
      createdAtIso: nowIso(),
    },
  ],
  verificationRequests: [
    {
      id: "dev-verification-1",
      chargerId: devChargerA.id,
      hostUserId: DEV_PREVIEW_SESSION_USER.uid,
      status: "pending",
      note: "Preview verification request",
      createdAtIso: nowIso(),
      updatedAtIso: nowIso(),
    },
  ],
  trips: [
    {
      id: "dev-trip-1",
      userId: DEV_PREVIEW_SESSION_USER.uid,
      origin: {
        label: "Sydney",
        latitude: -33.8688,
        longitude: 151.2093,
      },
      destination: {
        label: "Wollongong",
        latitude: -34.4278,
        longitude: 150.8931,
      },
      currentBatteryPercent: 68,
      vehicleMaxRangeKm: 500,
      distanceKm: 84,
      durationMinutes: 75,
      routePolyline: "preview-polyline",
      projectedArrivalPercent: 51.2,
      recommendedChargerId: devChargerA.id,
      createdAtIso: nowIso(),
      updatedAtIso: nowIso(),
    },
  ],
};

export function createDevId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

export function buildDevProfile(
  userId: string,
  role: UserProfile["role"] = "driver",
  displayName?: string,
  email?: string
): UserProfile {
  const existing = DEV_PREVIEW_STATE.profiles[userId];
  const next: UserProfile = {
    id: userId,
    email: email || existing?.email || DEV_PREVIEW_SESSION_USER.email,
    displayName: displayName || existing?.displayName || DEV_PREVIEW_SESSION_USER.displayName,
    role,
    phone: existing?.phone || "+61 400 000 000",
    preferredReservePercent: existing?.preferredReservePercent ?? 12,
    createdAtIso: existing?.createdAtIso || nowIso(),
    updatedAtIso: nowIso(),
  };

  DEV_PREVIEW_STATE.profiles[userId] = next;
  return next;
}

export function isFirebasePermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = String((error as { code?: string }).code || "").toLowerCase();
  const message = String((error as { message?: string }).message || "").toLowerCase();

  return (
    code.includes("permission-denied") ||
    code.includes("permission_denied") ||
    code.includes("missing-or-insufficient-permissions") ||
    code.includes("unauthenticated") ||
    message.includes("permission") ||
    message.includes("insufficient permissions")
  );
}

export function shouldUseDevPreviewFallback(error: unknown): boolean {
  return DEV_PREVIEW_MODE && isFirebasePermissionError(error);
}

export function logDevPreviewFallback(scope: string, error: unknown) {
  if (!DEV_PREVIEW_MODE) {
    return;
  }

  const errorCode =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code || "")
      : "";
  console.warn(`[DEV_PREVIEW] ${scope} fallback`, errorCode);
}
