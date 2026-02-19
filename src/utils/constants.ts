import { buildVehicle, type Vehicle } from "../models/Vehicle";

export const BATTERY_PERCENT_MIN = 0;
export const BATTERY_PERCENT_MAX = 100;

export const DEFAULT_BATTERY_CAPACITY_KWH = 60;
export const DEFAULT_EFFICIENCY_KWH_PER_100KM = 18;
export const DEFAULT_RESERVE_PERCENT = 15;

export const DEFAULT_VEHICLE: Vehicle = buildVehicle(
  DEFAULT_BATTERY_CAPACITY_KWH,
  DEFAULT_EFFICIENCY_KWH_PER_100KM,
  DEFAULT_RESERVE_PERCENT
);

export const APP_COLORS = {
  primary: "#0E7A56",
  background: "#F3F5F7",
  card: "#FFFFFF",
  text: "#111827",
  mutedText: "#6B7280",
  danger: "#B91C1C",
  success: "#166534",
  warningCard: "#FEE2E2",
  successCard: "#DCFCE7",
};
