export type AppRole = "driver" | "host" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  isDriver: boolean;
  isHost: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  phone?: string;
  avatarUrl?: string;
  preferredReservePercent?: number;
  stripeAccountId?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface UpsertUserProfileInput {
  email: string;
  displayName: string;
  role: AppRole;
  isDriver?: boolean;
  isHost?: boolean;
  phone?: string;
  preferredReservePercent?: number;
}
