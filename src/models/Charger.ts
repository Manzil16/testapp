export type ChargerStatus = "verified" | "community" | "flagged";

export interface Charger {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;

  powerKw: number;
  connectorType: "CCS2" | "CHAdeMO" | "Type2" | "NACS";

  status: ChargerStatus;

  verificationScore: number;
  reportCount: number;

  availability: {
    from: string; // "08:00"
    to: string;   // "22:00"
  };

  createdAtIso: string;
}
