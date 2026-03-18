// ─── VehicleGrid App-Wide Constants ─────────────────────────────
// Single source of truth for all magic numbers and configuration values.
// Only true UI constants (labels, enums) should remain in component files.

export const AppConfig = {
  // Platform fee percentage (0-100) applied to each booking
  PLATFORM_FEE_PERCENT: 20,

  // Booking auto-expiry after this duration (ms) if host doesn't respond
  BOOKING_EXPIRY_MS: 24 * 60 * 60 * 1000,

  // Default map region (Sydney, Australia)
  DEFAULT_REGION: {
    latitude: -33.8688,
    longitude: 151.2093,
    latitudeDelta: 0.6,
    longitudeDelta: 0.6,
  },

  // Charger listing defaults (for host charger form)
  CHARGER_DEFAULTS: {
    powerKw: 22,
    pricePerKwh: 0.55,
    minPowerKw: 7,
    minPricePerKwh: 0.2,
    maxPhotos: 6,
    defaultStartTime: "06:00",
    defaultEndTime: "22:00",
    defaultConnectors: ["Type2"] as string[],
    defaultState: "NSW",
  },

  // Vehicle defaults (for driver vehicle form)
  VEHICLE_DEFAULTS: {
    make: "Tesla",
    model: "Model Y",
    year: 2024,
    batteryCapacityKwh: 75,
    maxRangeKm: 505,
    efficiencyWhKm: 155,
    reservePercent: 12,
    bounds: {
      minYear: 2010,
      minBatteryKwh: 20,
      fallbackBatteryKwh: 60,
      minRangeKm: 120,
      fallbackRangeKm: 350,
      minEfficiencyKwhPer100: 8,
      minReservePercent: 5,
      maxReservePercent: 40,
    },
  },

  // Booking form defaults
  BOOKING_DEFAULTS: {
    defaultEstimatedKwh: 35,
    defaultDurationHours: 1,
  },

  // Verification scores
  VERIFICATION: {
    approvedScore: 92,
    rejectedScore: 20,
    reinstateScore: 86,
    suspendScore: 10,
    verifiedThreshold: 85,
    flaggedThreshold: 45,
    defaultPendingScore: 50,
    defaultApprovedScore: 90,
  },

  // Pagination
  PAGE_SIZE: 10,
  ADMIN_QUERY_LIMIT: 250,
  ADMIN_MAX_PROFILES: 300,

  // Polling intervals (ms)
  NOTIFICATION_REFETCH_INTERVAL: 30_000,
  NETWORK_CHECK_INTERVAL: 15_000,
  NETWORK_CHECK_TIMEOUT: 5_000,

  // Image upload
  IMAGE_MAX_WIDTH: 1200,
  CHARGER_IMAGE_BUCKET: "charger-images",

  // Dev mode
  DEV_TAP_COUNT: 7,

  // Trip planner
  MAX_SAVED_TRIPS: 5,

  // Geocoding
  GEOCODING_VIEWBOX_SPREAD: 1.8,

  // Pricing assistant
  PRICING: {
    // Market bands by charger speed tier (AUD/kWh)
    SLOW: { min: 0.25, suggested: 0.35, max: 0.50 },    // <= 7 kW
    STANDARD: { min: 0.35, suggested: 0.50, max: 0.65 }, // 7-22 kW
    FAST: { min: 0.45, suggested: 0.58, max: 0.75 },     // 22-50 kW
    ULTRA: { min: 0.55, suggested: 0.65, max: 0.85 },    // 50+ kW
  },
} as const;

// Currency options for user settings
export const CURRENCY_OPTIONS = ["AUD", "USD", "EUR", "GBP", "NZD"] as const;
export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number];

// Day abbreviations
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Connector type display labels
export const CONNECTOR_LABELS: Record<string, string> = {
  CCS2: "CCS2",
  CHAdeMO: "CHAdeMO",
  Type2: "Type 2",
  Tesla: "Tesla",
};

// Amenity options for charger form
export const AMENITY_OPTIONS = [
  "WiFi",
  "Parking",
  "Restroom",
  "Cafe",
  "CCTV",
  "Lighting",
] as const;

// Weekday options for availability
export const WEEKDAY_OPTIONS = [
  { key: "Mon", label: "Mon" },
  { key: "Tue", label: "Tue" },
  { key: "Wed", label: "Wed" },
  { key: "Thu", label: "Thu" },
  { key: "Fri", label: "Fri" },
  { key: "Sat", label: "Sat" },
  { key: "Sun", label: "Sun" },
] as const;
