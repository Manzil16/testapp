export type VerificationStatus = "pending" | "approved" | "rejected" | "suspended";

export interface VerificationRequest {
  id: string;
  chargerId: string;
  hostUserId: string;
  status: VerificationStatus;
  note: string;
  reviewedByUserId?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CreateVerificationRequestInput {
  chargerId: string;
  hostUserId: string;
  note?: string;
}
