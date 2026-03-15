export interface TripPoint {
  label: string;
  latitude: number;
  longitude: number;
}

export interface Trip {
  id: string;
  userId: string;
  origin: TripPoint;
  destination: TripPoint;
  currentBatteryPercent: number;
  vehicleMaxRangeKm: number;
  distanceKm: number;
  durationMinutes: number;
  routePolyline: string;
  projectedArrivalPercent: number;
  recommendedChargerId?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CreateTripInput {
  userId: string;
  origin: TripPoint;
  destination: TripPoint;
  currentBatteryPercent: number;
  vehicleMaxRangeKm: number;
  distanceKm: number;
  durationMinutes: number;
  routePolyline: string;
  projectedArrivalPercent: number;
  recommendedChargerId?: string;
}
