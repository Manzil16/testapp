import { Charger } from "../models/Charger";

export const seedChargers: Charger[] = [
  {
    id: "seed-1",
    name: "Sydney CBD Fast Hub",
    address: "Market St, Sydney NSW 2000",
    latitude: -33.871,
    longitude: 151.206,
    powerKw: 240,
    connectorType: "CCS2",
    status: "verified",
    verificationScore: 95,
    reportCount: 0,
    availability: { from: "00:00", to: "23:59" },
    createdAtIso: new Date().toISOString(),
  },
  {
    id: "seed-2",
    name: "Mascot Supercharge Point",
    address: "O'Riordan St, Mascot NSW 2020",
    latitude: -33.9249,
    longitude: 151.187,
    powerKw: 150,
    connectorType: "CCS2",
    status: "verified",
    verificationScore: 92,
    reportCount: 0,
    availability: { from: "06:00", to: "22:00" },
    createdAtIso: new Date().toISOString(),
  },
];
