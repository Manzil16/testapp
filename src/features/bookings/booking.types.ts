export type BookingStatus =
  | "requested"
  | "approved"
  | "declined"
  | "active"
  | "completed"
  | "cancelled"
  | "expired"
  | "missed";

export interface Booking {
  id: string;
  chargerId: string;
  driverUserId: string;
  hostUserId: string;
  startTimeIso: string;
  endTimeIso: string;
  estimatedKWh: number;
  subtotalAmount: number;
  totalAmount: number;
  platformFee: number;
  note: string;
  status: BookingStatus;
  arrivalSignal: "en_route" | "arrived" | "charging" | "departed" | null;
  expiresAtIso?: string;
  graceExpiresAtIso?: string;
  actualKWh?: number;
  actualAmount?: number;
  sessionStartedAtIso?: string;
  sessionEndedAtIso?: string;
  cancellationReason?: string;
  hostPayoutAmount?: number;
  stripePaymentIntentId?: string;
  paymentStatus?: string;
  cancelledAtIso?: string;
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
