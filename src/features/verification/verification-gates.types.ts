export interface VerificationGate {
  userId: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  paymentMethodAdded: boolean;
  idVerified: boolean;
  idDocumentUrl?: string;
  stripeOnboarded: boolean;
  stripeIdentitySessionId?: string;
  driverCleared: boolean;
  hostCleared: boolean;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface VerificationGatePatch {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  paymentMethodAdded?: boolean;
  idVerified?: boolean;
  idDocumentUrl?: string;
  stripeOnboarded?: boolean;
  stripeIdentitySessionId?: string;
}
