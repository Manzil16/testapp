export type BookingStatus =
  | "requested"
  | "approved"
  | "declined"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Booking {
  id: string;
  chargerId: string;
  driverUserId: string;
  hostUserId: string;
  startTimeIso: string;
  endTimeIso: string;
  estimatedKWh: number;
  note: string;
  status: BookingStatus;
  arrivalSignal: "en_route" | "arrived" | "charging" | "departed";
  expiresAtIso?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CreateBookingInput {
  chargerId: string;
  driverUserId: string;
  hostUserId: string;
  startTimeIso: string;
  endTimeIso: string;
  estimatedKWh: number;
  note?: string;
}
