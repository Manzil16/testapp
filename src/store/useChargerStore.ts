import { create } from "zustand";
import { Charger } from "../models/Charger";
import { seedChargers } from "../services/seedChargers";

interface ChargerState {
  chargers: Charger[];

  seedIfEmpty: () => void;

  addCommunityCharger: (charger: Omit<
    Charger,
    "id" | "status" | "verificationScore" | "reportCount" | "createdAtIso"
  >) => void;

  confirmWorking: (id: string) => void;
  reportBroken: (id: string) => void;
}

export const useChargerStore = create<ChargerState>((set, get) => ({
  chargers: [],

  seedIfEmpty: () => {
    if (get().chargers.length > 0) return;
    set({ chargers: seedChargers });
  },

  addCommunityCharger: (charger) =>
    set((state) => ({
      chargers: [
        ...state.chargers,
        {
          ...charger,
          id: Date.now().toString(),
          status: "community",
          verificationScore: 50,
          reportCount: 0,
          createdAtIso: new Date().toISOString(),
        },
      ],
    })),

  confirmWorking: (id) =>
    set((state) => ({
      chargers: state.chargers.map((c) =>
        c.id === id
          ? {
              ...c,
              verificationScore: Math.min(100, c.verificationScore + 10),
            }
          : c
      ),
    })),

  reportBroken: (id) =>
    set((state) => ({
      chargers: state.chargers.map((c) =>
        c.id === id
          ? {
              ...c,
              verificationScore: c.verificationScore - 15,
              reportCount: c.reportCount + 1,
              status:
                c.verificationScore - 15 <= 10 ? "flagged" : c.status,
            }
          : c
      ),
    })),
}));
