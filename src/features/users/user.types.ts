export type AppRole = "driver" | "host" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  phone?: string;
  avatarUrl?: string;
  preferredReservePercent?: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface UpsertUserProfileInput {
  email: string;
  displayName: string;
  role: AppRole;
  phone?: string;
  preferredReservePercent?: number;
}
