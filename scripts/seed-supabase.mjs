#!/usr/bin/env node
/**
 * VehicleGrid — Supabase Seed Script
 *
 * Seeds the Supabase database with realistic demo data for all entity types.
 * Requires a direct Postgres connection string.
 *
 * Usage:
 *   node scripts/seed-supabase.mjs "postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres"
 *
 * IMPORTANT: This script uses the service_role bypass to write directly.
 * For auth-gated tables (RLS), it inserts via Postgres, not the REST API.
 */
import pg from "pg";

const connectionString = process.argv[2];
if (!connectionString) {
  console.error("Usage: node scripts/seed-supabase.mjs <DATABASE_URL>");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// ─── Time helpers ────────────────────────────────────────────────
const now = new Date();
const hoursAgo = (h) => new Date(now.getTime() - h * 3600000).toISOString();
const hoursFromNow = (h) => new Date(now.getTime() + h * 3600000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

// ─── UUIDs (deterministic for idempotent re-runs) ───────────────
const DRIVER_ALEX =   "00000000-0000-4000-a000-000000000001";
const DRIVER_PRIYA =  "00000000-0000-4000-a000-000000000002";
const DRIVER_LIAM =   "00000000-0000-4000-a000-000000000003";
const HOST_SYDNEY =   "00000000-0000-4000-a000-000000000004";
const HOST_HUME =     "00000000-0000-4000-a000-000000000005";
const ADMIN_OPS =     "00000000-0000-4000-a000-000000000006";

const CHG_SYDNEY_CBD =    "10000000-0000-4000-b000-000000000001";
const CHG_PENRITH =       "10000000-0000-4000-b000-000000000002";
const CHG_NEWCASTLE =     "10000000-0000-4000-b000-000000000003";
const CHG_WOLLONGONG =    "10000000-0000-4000-b000-000000000004";
const CHG_GOULBURN =      "10000000-0000-4000-b000-000000000005";
const CHG_TAREE =         "10000000-0000-4000-b000-000000000006";

const BKG_ALEX_COMPLETE = "20000000-0000-4000-c000-000000000001";
const BKG_PRIYA_APPROVED= "20000000-0000-4000-c000-000000000002";
const BKG_LIAM_REQUESTED= "20000000-0000-4000-c000-000000000003";
const BKG_ALEX_INPROG =  "20000000-0000-4000-c000-000000000004";
const BKG_PRIYA_DECLINED= "20000000-0000-4000-c000-000000000005";

const VEH_ALEX =    "30000000-0000-4000-d000-000000000001";
const VEH_PRIYA =   "30000000-0000-4000-d000-000000000002";
const VEH_LIAM =    "30000000-0000-4000-d000-000000000003";

const REV_ALEX =    "40000000-0000-4000-e000-000000000001";
const REV_LIAM =    "40000000-0000-4000-e000-000000000002";

const TRIP_ALEX =   "50000000-0000-4000-f000-000000000001";
const TRIP_PRIYA =  "50000000-0000-4000-f000-000000000002";

const NOTIF_HOST_REQ =  "60000000-0000-4000-f100-000000000001";
const NOTIF_PRIYA_APR = "60000000-0000-4000-f100-000000000002";
const NOTIF_ADMIN_VER = "60000000-0000-4000-f100-000000000003";
const NOTIF_SYSTEM =    "60000000-0000-4000-f100-000000000004";

const VREQ_GOULBURN =  "70000000-0000-4000-f200-000000000001";
const VREQ_TAREE =     "70000000-0000-4000-f200-000000000002";

async function seed() {
  await client.connect();
  console.log("Connected to Supabase database");

  // We need auth users to exist first for FK references.
  // Insert into auth.users if they don't exist, then profiles.
  // Note: In production, users register through auth flow. This seeds demo accounts.

  // ─── PROFILES (upsert) ─────────────────────────────────────────
  const profiles = [
    [DRIVER_ALEX,  "alex.driver@vehiclegrid.demo",  "Alex Morgan",                  "driver", "+61 412 110 220", 12],
    [DRIVER_PRIYA, "priya.driver@vehiclegrid.demo",  "Priya Nair",                   "driver", "+61 417 884 220", 14],
    [DRIVER_LIAM,  "liam.driver@vehiclegrid.demo",   "Liam Chen",                    "driver", "+61 401 992 411", 10],
    [HOST_SYDNEY,  "sydney.host@vehiclegrid.demo",   "Harbour Charge Operations",    "host",   "+61 2 8001 1100", 12],
    [HOST_HUME,    "hume.host@vehiclegrid.demo",     "Hume Corridor Charging Pty Ltd","host",   "+61 2 6100 4433", 12],
    [ADMIN_OPS,    "ops.admin@vehiclegrid.demo",     "VehicleGrid Core Ops",         "admin",  "+61 2 9000 1001", 12],
  ];

  for (const [id, email, name, role, phone, reserve] of profiles) {
    await client.query(`
      INSERT INTO public.profiles (id, email, display_name, role, phone, preferred_reserve_percent)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        preferred_reserve_percent = EXCLUDED.preferred_reserve_percent
    `, [id, email, name, role, phone, reserve]);
  }
  console.log(`Profiles: ${profiles.length} upserted`);

  // ─── CHARGERS ──────────────────────────────────────────────────
  const chargers = [
    {
      id: CHG_SYDNEY_CBD, host_id: HOST_SYDNEY,
      name: "Sydney CBD Fast Hub", address: "388 George St, Sydney NSW 2000",
      suburb: "Sydney", state: "NSW", latitude: -33.8697, longitude: 151.207,
      max_power_kw: 250, price_per_kwh: 0.65,
      connectors: JSON.stringify([
        { type: "CCS2", powerKw: 250, count: 4 },
        { type: "Type2", powerKw: 22, count: 2 },
      ]),
      amenities: ["Cafe", "Toilets", "CCTV", "Wheelchair Access"],
      availability_note: "24/7 monitored site",
      availability_window: JSON.stringify({ days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], startTime: "00:00", endTime: "23:59" }),
      status: "approved", verification_score: 95,
    },
    {
      id: CHG_PENRITH, host_id: HOST_SYDNEY,
      name: "Penrith M4 Ultra Charge", address: "Mulgoa Rd, Penrith NSW 2750",
      suburb: "Penrith", state: "NSW", latitude: -33.7511, longitude: 150.6942,
      max_power_kw: 180, price_per_kwh: 0.59,
      connectors: JSON.stringify([
        { type: "CCS2", powerKw: 180, count: 3 },
        { type: "CHAdeMO", powerKw: 50, count: 1 },
      ]),
      amenities: ["Food Court", "Restrooms", "Shops"],
      availability_note: "Open daily 05:00-23:30",
      availability_window: JSON.stringify({ days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], startTime: "05:00", endTime: "23:30" }),
      status: "approved", verification_score: 89,
    },
    {
      id: CHG_NEWCASTLE, host_id: HOST_SYDNEY,
      name: "Newcastle Harbour Charge Point", address: "Honeysuckle Dr, Newcastle NSW 2300",
      suburb: "Newcastle", state: "NSW", latitude: -32.9256, longitude: 151.7708,
      max_power_kw: 150, price_per_kwh: 0.57,
      connectors: JSON.stringify([
        { type: "CCS2", powerKw: 150, count: 2 },
        { type: "Type2", powerKw: 22, count: 2 },
      ]),
      amenities: ["Cafe", "Waterfront", "Lighting"],
      availability_note: "24/7, weekend demand peaks",
      availability_window: JSON.stringify({ days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], startTime: "00:00", endTime: "23:59" }),
      status: "approved", verification_score: 84,
    },
    {
      id: CHG_WOLLONGONG, host_id: HOST_HUME,
      name: "Wollongong Escarpment Fast Charge", address: "Princes Hwy, Wollongong NSW 2500",
      suburb: "Wollongong", state: "NSW", latitude: -34.4278, longitude: 150.8931,
      max_power_kw: 120, price_per_kwh: 0.54,
      connectors: JSON.stringify([
        { type: "CCS2", powerKw: 120, count: 2 },
        { type: "Type2", powerKw: 22, count: 1 },
      ]),
      amenities: ["Rest Area", "Food", "Toilets"],
      availability_note: "06:00-22:00",
      availability_window: JSON.stringify({ days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], startTime: "06:00", endTime: "22:00" }),
      status: "approved", verification_score: 78,
    },
    {
      id: CHG_GOULBURN, host_id: HOST_HUME,
      name: "Goulburn Hume Gateway", address: "Hume Hwy, Goulburn NSW 2580",
      suburb: "Goulburn", state: "NSW", latitude: -34.754, longitude: 149.71,
      max_power_kw: 180, price_per_kwh: 0.62,
      connectors: JSON.stringify([
        { type: "CCS2", powerKw: 180, count: 2 },
        { type: "CHAdeMO", powerKw: 50, count: 1 },
      ]),
      amenities: ["Truck Stop", "24/7 Store", "Toilets"],
      availability_note: "24/7 heavy corridor stop",
      availability_window: JSON.stringify({ days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], startTime: "00:00", endTime: "23:59" }),
      status: "pending", verification_score: 52,
    },
    {
      id: CHG_TAREE, host_id: HOST_HUME,
      name: "Taree Pacific Highway Hub", address: "Pacific Hwy, Taree NSW 2430",
      suburb: "Taree", state: "NSW", latitude: -31.9107, longitude: 152.4587,
      max_power_kw: 75, price_per_kwh: 0.58,
      connectors: JSON.stringify([
        { type: "CCS2", powerKw: 75, count: 2 },
        { type: "Type2", powerKw: 22, count: 1 },
      ]),
      amenities: ["Limited Lighting", "Coffee Van"],
      availability_note: "06:00-20:00, maintenance window Tue 02:00",
      availability_window: JSON.stringify({ days: ["Mon","Wed","Thu","Fri","Sat","Sun"], startTime: "06:00", endTime: "20:00" }),
      status: "rejected", verification_score: 18,
    },
  ];

  for (const c of chargers) {
    await client.query(`
      INSERT INTO public.chargers (id, host_id, name, address, suburb, state, latitude, longitude,
        max_power_kw, price_per_kwh, connectors, amenities, availability_note, availability_window,
        images, status, verification_score)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, address = EXCLUDED.address, suburb = EXCLUDED.suburb,
        state = EXCLUDED.state, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
        max_power_kw = EXCLUDED.max_power_kw, price_per_kwh = EXCLUDED.price_per_kwh,
        connectors = EXCLUDED.connectors, amenities = EXCLUDED.amenities,
        availability_note = EXCLUDED.availability_note, availability_window = EXCLUDED.availability_window,
        status = EXCLUDED.status, verification_score = EXCLUDED.verification_score
    `, [
      c.id, c.host_id, c.name, c.address, c.suburb, c.state, c.latitude, c.longitude,
      c.max_power_kw, c.price_per_kwh, c.connectors, c.amenities,
      c.availability_note, c.availability_window, '{}', c.status, c.verification_score,
    ]);
  }
  console.log(`Chargers: ${chargers.length} upserted`);

  // ─── VEHICLES ──────────────────────────────────────────────────
  const vehicles = [
    [VEH_ALEX,  DRIVER_ALEX,  "Alex Model Y Long Range",  "Tesla",   "Model Y", 2024, 75,   505, 15.5, 12],
    [VEH_PRIYA, DRIVER_PRIYA, "Priya IONIQ 5 AWD",        "Hyundai", "IONIQ 5", 2023, 77.4, 454, 17.0, 14],
    [VEH_LIAM,  DRIVER_LIAM,  "Liam Kia EV6 GT-Line",     "Kia",     "EV6",     2024, 77.4, 484, 16.2, 10],
  ];

  for (const [id, uid, name, make, model, year, bat, range, eff, reserve] of vehicles) {
    await client.query(`
      INSERT INTO public.vehicles (id, user_id, name, make, model, year, battery_capacity_kwh, max_range_km, efficiency_kwh_per_100km, default_reserve_percent)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, make = EXCLUDED.make, model = EXCLUDED.model,
        year = EXCLUDED.year, battery_capacity_kwh = EXCLUDED.battery_capacity_kwh,
        max_range_km = EXCLUDED.max_range_km, efficiency_kwh_per_100km = EXCLUDED.efficiency_kwh_per_100km,
        default_reserve_percent = EXCLUDED.default_reserve_percent
    `, [id, uid, name, make, model, year, bat, range, eff, reserve]);
  }
  console.log(`Vehicles: ${vehicles.length} upserted`);

  // ─── BOOKINGS ──────────────────────────────────────────────────
  const bookings = [
    {
      id: BKG_ALEX_COMPLETE, charger_id: CHG_SYDNEY_CBD,
      driver_id: DRIVER_ALEX, host_id: HOST_SYDNEY,
      start_time: hoursAgo(10), end_time: hoursAgo(8.5),
      estimated_kwh: 28, total_amount: 18.20, platform_fee: 3.64,
      note: "Need fast top-up before Wollongong trip",
      status: "completed", arrival_signal: "departed",
    },
    {
      id: BKG_PRIYA_APPROVED, charger_id: CHG_PENRITH,
      driver_id: DRIVER_PRIYA, host_id: HOST_SYDNEY,
      start_time: hoursFromNow(1.5), end_time: hoursFromNow(3),
      estimated_kwh: 34, total_amount: 20.06, platform_fee: 4.01,
      note: "Heading toward Orange same day",
      status: "approved", arrival_signal: "en_route",
    },
    {
      id: BKG_LIAM_REQUESTED, charger_id: CHG_NEWCASTLE,
      driver_id: DRIVER_LIAM, host_id: HOST_SYDNEY,
      start_time: hoursFromNow(3.5), end_time: hoursFromNow(5),
      estimated_kwh: 22, total_amount: 12.54, platform_fee: 2.51,
      note: "Quick stop before heading north",
      status: "requested", arrival_signal: "en_route",
      expires_at: hoursFromNow(24),
    },
    {
      id: BKG_ALEX_INPROG, charger_id: CHG_GOULBURN,
      driver_id: DRIVER_ALEX, host_id: HOST_HUME,
      start_time: hoursFromNow(0.5), end_time: hoursFromNow(2),
      estimated_kwh: 40, total_amount: 24.80, platform_fee: 4.96,
      note: "Canberra corridor run",
      status: "in_progress", arrival_signal: "charging",
    },
    {
      id: BKG_PRIYA_DECLINED, charger_id: CHG_WOLLONGONG,
      driver_id: DRIVER_PRIYA, host_id: HOST_HUME,
      start_time: hoursFromNow(5), end_time: hoursFromNow(6),
      estimated_kwh: 25, total_amount: 13.50, platform_fee: 2.70,
      note: "Late afternoon arrival",
      status: "declined", arrival_signal: "en_route",
    },
  ];

  for (const b of bookings) {
    await client.query(`
      INSERT INTO public.bookings (id, charger_id, driver_id, host_id, start_time, end_time,
        estimated_kwh, total_amount, platform_fee, note, status, arrival_signal, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status, arrival_signal = EXCLUDED.arrival_signal,
        total_amount = EXCLUDED.total_amount, platform_fee = EXCLUDED.platform_fee,
        note = EXCLUDED.note
    `, [
      b.id, b.charger_id, b.driver_id, b.host_id, b.start_time, b.end_time,
      b.estimated_kwh, b.total_amount, b.platform_fee, b.note, b.status,
      b.arrival_signal, b.expires_at || null,
    ]);
  }
  console.log(`Bookings: ${bookings.length} upserted`);

  // ─── REVIEWS ───────────────────────────────────────────────────
  const reviews = [
    [REV_ALEX, BKG_ALEX_COMPLETE, CHG_SYDNEY_CBD, DRIVER_ALEX, HOST_SYDNEY, 4.8, "Reliable high-speed chargers and easy CBD access."],
    [REV_LIAM, BKG_LIAM_REQUESTED, CHG_NEWCASTLE, DRIVER_LIAM, HOST_SYDNEY, 4.5, "Great waterfront location, signage could be clearer at night."],
  ];

  for (const [id, bid, cid, did, hid, rating, comment] of reviews) {
    await client.query(`
      INSERT INTO public.reviews (id, booking_id, charger_id, driver_id, host_id, rating, comment)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
    `, [id, bid, cid, did, hid, rating, comment]);
  }
  console.log(`Reviews: ${reviews.length} upserted`);

  // ─── TRIPS ─────────────────────────────────────────────────────
  const trips = [
    {
      id: TRIP_ALEX, user_id: DRIVER_ALEX,
      origin: JSON.stringify({ label: "Circular Quay, Sydney", latitude: -33.8617, longitude: 151.2108 }),
      destination: JSON.stringify({ label: "Wollongong CBD", latitude: -34.4278, longitude: 150.8931 }),
      current_battery_percent: 71, vehicle_max_range_km: 505,
      distance_km: 84, duration_minutes: 77,
      route_polyline: "m`miE~fys[",
      projected_arrival_percent: 54.4,
      recommended_charger_id: CHG_WOLLONGONG,
    },
    {
      id: TRIP_PRIYA, user_id: DRIVER_PRIYA,
      origin: JSON.stringify({ label: "Parramatta", latitude: -33.815, longitude: 151.0011 }),
      destination: JSON.stringify({ label: "Goulburn", latitude: -34.754, longitude: 149.71 }),
      current_battery_percent: 48, vehicle_max_range_km: 454,
      distance_km: 196, duration_minutes: 136,
      route_polyline: "w~miEryys[",
      projected_arrival_percent: 4.8,
      recommended_charger_id: CHG_GOULBURN,
    },
  ];

  for (const t of trips) {
    await client.query(`
      INSERT INTO public.trips (id, user_id, origin, destination, current_battery_percent,
        vehicle_max_range_km, distance_km, duration_minutes, route_polyline,
        projected_arrival_percent, recommended_charger_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        origin = EXCLUDED.origin, destination = EXCLUDED.destination,
        projected_arrival_percent = EXCLUDED.projected_arrival_percent
    `, [
      t.id, t.user_id, t.origin, t.destination, t.current_battery_percent,
      t.vehicle_max_range_km, t.distance_km, t.duration_minutes,
      t.route_polyline, t.projected_arrival_percent, t.recommended_charger_id,
    ]);
  }
  console.log(`Trips: ${trips.length} upserted`);

  // ─── NOTIFICATIONS ─────────────────────────────────────────────
  const notifications = [
    [NOTIF_HOST_REQ,  HOST_SYDNEY,  "New booking request", "Liam requested a booking at Newcastle Harbour Charge Point.", "booking", false, JSON.stringify({ bookingId: BKG_LIAM_REQUESTED, chargerId: CHG_NEWCASTLE })],
    [NOTIF_PRIYA_APR, DRIVER_PRIYA, "Booking approved", "Your Penrith M4 Ultra booking has been approved.", "booking", false, JSON.stringify({ bookingId: BKG_PRIYA_APPROVED, status: "approved" })],
    [NOTIF_ADMIN_VER, ADMIN_OPS,    "Verification queue update", "New charger awaiting verification on Hume corridor.", "verification", false, JSON.stringify({ requestId: VREQ_GOULBURN, chargerId: CHG_GOULBURN })],
    [NOTIF_SYSTEM,    DRIVER_ALEX,  "Welcome to VehicleGrid", "Your account is set up. Discover chargers near you!", "system", true, null],
  ];

  for (const [id, uid, title, body, type, read, meta] of notifications) {
    await client.query(`
      INSERT INTO public.notifications (id, user_id, title, body, type, is_read, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, is_read = EXCLUDED.is_read
    `, [id, uid, title, body, type, read, meta]);
  }
  console.log(`Notifications: ${notifications.length} upserted`);

  // ─── VERIFICATION REQUESTS ─────────────────────────────────────
  const verifications = [
    [VREQ_GOULBURN, CHG_GOULBURN, HOST_HUME, "pending", "Submitted with full electrical compliance docs.", null],
    [VREQ_TAREE,    CHG_TAREE,    HOST_HUME, "rejected", "Multiple outage incidents pending hardware replacement.", ADMIN_OPS],
  ];

  for (const [id, cid, hid, status, note, reviewer] of verifications) {
    await client.query(`
      INSERT INTO public.verification_requests (id, charger_id, host_id, status, note, reviewed_by)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, reviewed_by = EXCLUDED.reviewed_by
    `, [id, cid, hid, status, note, reviewer]);
  }
  console.log(`Verification Requests: ${verifications.length} upserted`);

  console.log("\n✅ VehicleGrid Supabase seed complete!");
  console.log("Summary:");
  console.log(`  Profiles:              ${profiles.length}`);
  console.log(`  Chargers:              ${chargers.length}`);
  console.log(`  Vehicles:              ${vehicles.length}`);
  console.log(`  Bookings:              ${bookings.length}`);
  console.log(`  Reviews:               ${reviews.length}`);
  console.log(`  Trips:                 ${trips.length}`);
  console.log(`  Notifications:         ${notifications.length}`);
  console.log(`  Verification Requests: ${verifications.length}`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
