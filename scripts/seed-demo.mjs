import { initializeApp } from "firebase/app";
import {
  Timestamp,
  doc,
  getFirestore,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBf1xAVBtu4dglRsGGIcNa99tDlsJiUT08",
  authDomain: "vehiclegrid-app.firebaseapp.com",
  projectId: "vehiclegrid-app",
  storageBucket: "vehiclegrid-app.firebasestorage.app",
  messagingSenderId: "1053969645594",
  appId: "1:1053969645594:web:d80c36c434283728add1a3",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const now = new Date();
const minutes = (delta) => new Date(now.getTime() + delta * 60 * 1000);
const ts = (delta) => Timestamp.fromDate(minutes(delta));

const users = [
  {
    id: "seed-driver-alex",
    email: "alex.driver@vehiclegrid.demo",
    displayName: "Alex Morgan",
    role: "driver",
    phone: "+61 412 110 220",
    preferredReservePercent: 12,
    createdAt: ts(-60 * 24 * 30),
    updatedAt: ts(-60 * 12),
  },
  {
    id: "seed-driver-priya",
    email: "priya.driver@vehiclegrid.demo",
    displayName: "Priya Nair",
    role: "driver",
    phone: "+61 417 884 220",
    preferredReservePercent: 14,
    createdAt: ts(-60 * 24 * 25),
    updatedAt: ts(-60 * 3),
  },
  {
    id: "seed-driver-liam",
    email: "liam.driver@vehiclegrid.demo",
    displayName: "Liam Chen",
    role: "driver",
    phone: "+61 401 992 411",
    preferredReservePercent: 10,
    createdAt: ts(-60 * 24 * 20),
    updatedAt: ts(-60 * 8),
  },
  {
    id: "seed-host-sydneyhub",
    email: "sydney.host@vehiclegrid.demo",
    displayName: "Harbour Charge Operations",
    role: "host",
    phone: "+61 2 8001 1100",
    preferredReservePercent: 12,
    createdAt: ts(-60 * 24 * 80),
    updatedAt: ts(-60 * 5),
  },
  {
    id: "seed-host-humecharge",
    email: "hume.host@vehiclegrid.demo",
    displayName: "Hume Corridor Charging Pty Ltd",
    role: "host",
    phone: "+61 2 6100 4433",
    preferredReservePercent: 12,
    createdAt: ts(-60 * 24 * 70),
    updatedAt: ts(-60 * 2),
  },
  {
    id: "seed-admin-coreops",
    email: "ops.admin@vehiclegrid.demo",
    displayName: "VehicleGrid Core Ops",
    role: "admin",
    phone: "+61 2 9000 1001",
    preferredReservePercent: 12,
    createdAt: ts(-60 * 24 * 200),
    updatedAt: ts(-60),
  },
];

const vehicles = [
  {
    id: "seed-vehicle-alex-y",
    userId: "seed-driver-alex",
    name: "Alex Model Y Long Range",
    make: "Tesla",
    model: "Model Y",
    year: 2024,
    batteryCapacityKWh: 75,
    maxRangeKm: 505,
    efficiencyKWhPer100Km: 15.5,
    defaultReservePercent: 12,
    createdAt: ts(-60 * 24 * 10),
    updatedAt: ts(-60 * 10),
  },
  {
    id: "seed-vehicle-priya-ioniq5",
    userId: "seed-driver-priya",
    name: "Priya IONIQ 5 AWD",
    make: "Hyundai",
    model: "IONIQ 5",
    year: 2023,
    batteryCapacityKWh: 77.4,
    maxRangeKm: 454,
    efficiencyKWhPer100Km: 17,
    defaultReservePercent: 14,
    createdAt: ts(-60 * 24 * 9),
    updatedAt: ts(-60 * 6),
  },
  {
    id: "seed-vehicle-liam-ev6",
    userId: "seed-driver-liam",
    name: "Liam Kia EV6 GT-Line",
    make: "Kia",
    model: "EV6",
    year: 2024,
    batteryCapacityKWh: 77.4,
    maxRangeKm: 484,
    efficiencyKWhPer100Km: 16.2,
    defaultReservePercent: 10,
    createdAt: ts(-60 * 24 * 12),
    updatedAt: ts(-60 * 4),
  },
];

const chargers = [
  {
    id: "seed-charger-sydney-cbd-fast-hub",
    hostUserId: "seed-host-sydneyhub",
    name: "Sydney CBD Fast Hub",
    address: "388 George St, Sydney NSW 2000",
    suburb: "Sydney",
    state: "NSW",
    latitude: -33.8697,
    longitude: 151.207,
    maxPowerKw: 250,
    pricingPerKwh: 0.65,
    connectors: [
      { type: "CCS2", powerKw: 250, count: 4 },
      { type: "Type2", powerKw: 22, count: 2 },
    ],
    amenities: ["Cafe", "Toilets", "CCTV", "Wheelchair Access"],
    availabilityNote: "24/7 monitored site",
    status: "verified",
    verificationScore: 95,
    createdAt: ts(-60 * 24 * 50),
    updatedAt: ts(-60 * 6),
  },
  {
    id: "seed-charger-penrith-m4-ultra",
    hostUserId: "seed-host-sydneyhub",
    name: "Penrith M4 Ultra Charge",
    address: "Mulgoa Rd, Penrith NSW 2750",
    suburb: "Penrith",
    state: "NSW",
    latitude: -33.7511,
    longitude: 150.6942,
    maxPowerKw: 180,
    pricingPerKwh: 0.59,
    connectors: [
      { type: "CCS2", powerKw: 180, count: 3 },
      { type: "CHAdeMO", powerKw: 50, count: 1 },
    ],
    amenities: ["Food Court", "Restrooms", "Shops"],
    availabilityNote: "Open daily 05:00-23:30",
    status: "verified",
    verificationScore: 89,
    createdAt: ts(-60 * 24 * 45),
    updatedAt: ts(-60 * 8),
  },
  {
    id: "seed-charger-newcastle-harbour",
    hostUserId: "seed-host-sydneyhub",
    name: "Newcastle Harbour Charge Point",
    address: "Honeysuckle Dr, Newcastle NSW 2300",
    suburb: "Newcastle",
    state: "NSW",
    latitude: -32.9256,
    longitude: 151.7708,
    maxPowerKw: 150,
    pricingPerKwh: 0.57,
    connectors: [
      { type: "CCS2", powerKw: 150, count: 2 },
      { type: "Type2", powerKw: 22, count: 2 },
    ],
    amenities: ["Cafe", "Waterfront", "Lighting"],
    availabilityNote: "24/7, weekend demand peaks",
    status: "verified",
    verificationScore: 84,
    createdAt: ts(-60 * 24 * 40),
    updatedAt: ts(-60 * 7),
  },
  {
    id: "seed-charger-wollongong-escarpment",
    hostUserId: "seed-host-humecharge",
    name: "Wollongong Escarpment Fast Charge",
    address: "Princes Hwy, Wollongong NSW 2500",
    suburb: "Wollongong",
    state: "NSW",
    latitude: -34.4278,
    longitude: 150.8931,
    maxPowerKw: 120,
    pricingPerKwh: 0.54,
    connectors: [
      { type: "CCS2", powerKw: 120, count: 2 },
      { type: "Type2", powerKw: 22, count: 1 },
    ],
    amenities: ["Rest Area", "Food", "Toilets"],
    availabilityNote: "06:00-22:00",
    status: "verified",
    verificationScore: 78,
    createdAt: ts(-60 * 24 * 35),
    updatedAt: ts(-60 * 5),
  },
  {
    id: "seed-charger-goulburn-hume-gateway",
    hostUserId: "seed-host-humecharge",
    name: "Goulburn Hume Gateway",
    address: "Hume Hwy, Goulburn NSW 2580",
    suburb: "Goulburn",
    state: "NSW",
    latitude: -34.754,
    longitude: 149.71,
    maxPowerKw: 180,
    pricingPerKwh: 0.62,
    connectors: [
      { type: "CCS2", powerKw: 180, count: 2 },
      { type: "CHAdeMO", powerKw: 50, count: 1 },
    ],
    amenities: ["Truck Stop", "24/7 Store", "Toilets"],
    availabilityNote: "24/7 heavy corridor stop",
    status: "pending_verification",
    verificationScore: 52,
    createdAt: ts(-60 * 24 * 7),
    updatedAt: ts(-60 * 2),
  },
  {
    id: "seed-charger-taree-pacific-hub",
    hostUserId: "seed-host-humecharge",
    name: "Taree Pacific Highway Hub",
    address: "Pacific Hwy, Taree NSW 2430",
    suburb: "Taree",
    state: "NSW",
    latitude: -31.9107,
    longitude: 152.4587,
    maxPowerKw: 75,
    pricingPerKwh: 0.58,
    connectors: [
      { type: "CCS2", powerKw: 75, count: 2 },
      { type: "Type2", powerKw: 22, count: 1 },
    ],
    amenities: ["Limited Lighting", "Coffee Van"],
    availabilityNote: "06:00-20:00, maintenance window Tue 02:00",
    status: "suspended",
    verificationScore: 18,
    createdAt: ts(-60 * 24 * 30),
    updatedAt: ts(-60),
  },
];

const bookings = [
  {
    id: "seed-booking-alex-sydney-complete",
    chargerId: "seed-charger-sydney-cbd-fast-hub",
    driverUserId: "seed-driver-alex",
    hostUserId: "seed-host-sydneyhub",
    startTimeIso: minutes(-60 * 10).toISOString(),
    endTimeIso: minutes(-60 * 9 + -20).toISOString(),
    estimatedKWh: 28,
    note: "Need fast top-up before Wollongong trip",
    status: "completed",
    arrivalSignal: "departed",
    createdAt: ts(-60 * 11),
    updatedAt: ts(-60 * 8),
  },
  {
    id: "seed-booking-priya-penrith-approved",
    chargerId: "seed-charger-penrith-m4-ultra",
    driverUserId: "seed-driver-priya",
    hostUserId: "seed-host-sydneyhub",
    startTimeIso: minutes(90).toISOString(),
    endTimeIso: minutes(160).toISOString(),
    estimatedKWh: 34,
    note: "Heading toward Orange same day",
    status: "approved",
    arrivalSignal: "en_route",
    createdAt: ts(-120),
    updatedAt: ts(-40),
  },
  {
    id: "seed-booking-liam-newcastle-requested",
    chargerId: "seed-charger-newcastle-harbour",
    driverUserId: "seed-driver-liam",
    hostUserId: "seed-host-sydneyhub",
    startTimeIso: minutes(210).toISOString(),
    endTimeIso: minutes(270).toISOString(),
    estimatedKWh: 22,
    note: "Quick stop before heading north",
    status: "requested",
    arrivalSignal: "en_route",
    createdAt: ts(-70),
    updatedAt: ts(-35),
  },
  {
    id: "seed-booking-alex-goulburn-inprogress",
    chargerId: "seed-charger-goulburn-hume-gateway",
    driverUserId: "seed-driver-alex",
    hostUserId: "seed-host-humecharge",
    startTimeIso: minutes(40).toISOString(),
    endTimeIso: minutes(120).toISOString(),
    estimatedKWh: 40,
    note: "Canberra corridor run",
    status: "in_progress",
    arrivalSignal: "charging",
    createdAt: ts(-55),
    updatedAt: ts(-15),
  },
  {
    id: "seed-booking-priya-wollongong-declined",
    chargerId: "seed-charger-wollongong-escarpment",
    driverUserId: "seed-driver-priya",
    hostUserId: "seed-host-humecharge",
    startTimeIso: minutes(300).toISOString(),
    endTimeIso: minutes(360).toISOString(),
    estimatedKWh: 25,
    note: "Late afternoon arrival",
    status: "declined",
    arrivalSignal: "en_route",
    createdAt: ts(-150),
    updatedAt: ts(-130),
  },
];

const reviews = [
  {
    id: "seed-review-alex-sydney",
    bookingId: "seed-booking-alex-sydney-complete",
    chargerId: "seed-charger-sydney-cbd-fast-hub",
    driverUserId: "seed-driver-alex",
    hostUserId: "seed-host-sydneyhub",
    rating: 4.8,
    comment: "Reliable high-speed chargers and easy CBD access.",
    createdAt: ts(-60 * 7),
  },
  {
    id: "seed-review-liam-harbour",
    bookingId: "seed-booking-liam-newcastle-requested",
    chargerId: "seed-charger-newcastle-harbour",
    driverUserId: "seed-driver-liam",
    hostUserId: "seed-host-sydneyhub",
    rating: 4.5,
    comment: "Great waterfront location, signage could be clearer at night.",
    createdAt: ts(-60 * 5),
  },
];

const notifications = [
  {
    id: "seed-note-host-request-liam",
    userId: "seed-host-sydneyhub",
    title: "New booking request",
    body: "Liam requested a booking at Newcastle Harbour Charge Point.",
    type: "booking",
    isRead: false,
    metadata: {
      bookingId: "seed-booking-liam-newcastle-requested",
      chargerId: "seed-charger-newcastle-harbour",
    },
    createdAt: ts(-30),
  },
  {
    id: "seed-note-driver-priya-approved",
    userId: "seed-driver-priya",
    title: "Booking approved",
    body: "Your Penrith M4 Ultra booking has been approved.",
    type: "booking",
    isRead: false,
    metadata: {
      bookingId: "seed-booking-priya-penrith-approved",
      status: "approved",
    },
    createdAt: ts(-25),
  },
  {
    id: "seed-note-admin-verify",
    userId: "seed-admin-coreops",
    title: "Verification queue update",
    body: "New charger awaiting verification on Hume corridor.",
    type: "verification",
    isRead: false,
    metadata: {
      requestId: "seed-verification-goulburn",
      chargerId: "seed-charger-goulburn-hume-gateway",
    },
    createdAt: ts(-20),
  },
];

const verificationRequests = [
  {
    id: "seed-verification-goulburn",
    chargerId: "seed-charger-goulburn-hume-gateway",
    hostUserId: "seed-host-humecharge",
    status: "pending",
    note: "Submitted with full electrical compliance docs.",
    reviewedByUserId: "",
    createdAt: ts(-60 * 6),
    updatedAt: ts(-60 * 2),
  },
  {
    id: "seed-verification-taree-suspend",
    chargerId: "seed-charger-taree-pacific-hub",
    hostUserId: "seed-host-humecharge",
    status: "suspended",
    note: "Multiple outage incidents pending hardware replacement.",
    reviewedByUserId: "seed-admin-coreops",
    createdAt: ts(-60 * 24 * 6),
    updatedAt: ts(-60 * 5),
  },
];

const trips = [
  {
    id: "seed-trip-alex-sydney-wollongong",
    userId: "seed-driver-alex",
    origin: {
      label: "Circular Quay, Sydney",
      latitude: -33.8617,
      longitude: 151.2108,
    },
    destination: {
      label: "Wollongong CBD",
      latitude: -34.4278,
      longitude: 150.8931,
    },
    currentBatteryPercent: 71,
    vehicleMaxRangeKm: 505,
    distanceKm: 84,
    durationMinutes: 77,
    routePolyline: "m`miE~fys[", // placeholder polyline length for demo UI
    projectedArrivalPercent: 54.4,
    recommendedChargerId: "seed-charger-wollongong-escarpment",
    createdAt: ts(-60 * 9),
    updatedAt: ts(-60 * 9),
  },
  {
    id: "seed-trip-priya-sydney-goulburn",
    userId: "seed-driver-priya",
    origin: {
      label: "Parramatta",
      latitude: -33.815,
      longitude: 151.0011,
    },
    destination: {
      label: "Goulburn",
      latitude: -34.754,
      longitude: 149.71,
    },
    currentBatteryPercent: 48,
    vehicleMaxRangeKm: 454,
    distanceKm: 196,
    durationMinutes: 136,
    routePolyline: "w~miEryys[",
    projectedArrivalPercent: 4.8,
    recommendedChargerId: "seed-charger-goulburn-hume-gateway",
    createdAt: ts(-60 * 4),
    updatedAt: ts(-60 * 3),
  },
];

async function upsertCollection(batch, collectionName, items) {
  for (const item of items) {
    const ref = doc(db, collectionName, item.id);
    batch.set(ref, item, { merge: true });
  }
}

async function runSeed() {
  const batch = writeBatch(db);

  await upsertCollection(batch, "users", users);
  await upsertCollection(batch, "vehicles", vehicles);
  await upsertCollection(batch, "chargers", chargers);
  await upsertCollection(batch, "bookings", bookings);
  await upsertCollection(batch, "reviews", reviews);
  await upsertCollection(batch, "notifications", notifications);
  await upsertCollection(batch, "verificationRequests", verificationRequests);
  await upsertCollection(batch, "trips", trips);

  await batch.commit();

  console.log("VehicleGrid demo seed complete.");
  console.log(`users: ${users.length}`);
  console.log(`vehicles: ${vehicles.length}`);
  console.log(`chargers: ${chargers.length}`);
  console.log(`bookings: ${bookings.length}`);
  console.log(`reviews: ${reviews.length}`);
  console.log(`notifications: ${notifications.length}`);
  console.log(`verificationRequests: ${verificationRequests.length}`);
  console.log(`trips: ${trips.length}`);
}

runSeed().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
