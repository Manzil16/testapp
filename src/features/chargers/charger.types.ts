export type ChargerStatus = "pending" | "approved" | "rejected";

export type ConnectorType = "CCS2" | "CHAdeMO" | "Type2" | "Tesla";
export type AvailabilityDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface ChargerAvailabilityWindow {
  days: AvailabilityDay[];
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface ChargerConnector {
  type: ConnectorType;
  powerKw: number;
  count: number;
}

export interface Charger {
  id: string;
  hostUserId: string;
  name: string;
  address: string;
  suburb: string;
  state: string;
  latitude: number;
  longitude: number;
  maxPowerKw: number;
  pricingPerKwh: number;
  connectors: ChargerConnector[];
  amenities: string[];
  availabilityNote: string;
  availabilityWindow?: ChargerAvailabilityWindow;
  images: string[];
  status: ChargerStatus;
  verificationScore: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface UpsertChargerInput {
  name: string;
  address: string;
  suburb: string;
  state: string;
  latitude: number;
  longitude: number;
  maxPowerKw: number;
  pricingPerKwh: number;
  connectors: ChargerConnector[];
  amenities: string[];
  availabilityNote: string;
  availabilityWindow?: ChargerAvailabilityWindow;
  images?: string[];
}

export interface ChargerFilter {
  searchText?: string;
  minPowerKw?: number;
  connectorType?: ConnectorType;
  state?: string;
  status?: ChargerStatus;
}
