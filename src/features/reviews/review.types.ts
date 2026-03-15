export interface Review {
  id: string;
  bookingId: string;
  chargerId: string;
  driverUserId: string;
  hostUserId: string;
  rating: number;
  comment: string;
  createdAtIso: string;
}

export interface CreateReviewInput {
  bookingId: string;
  chargerId: string;
  driverUserId: string;
  hostUserId: string;
  rating: number;
  comment?: string;
}
