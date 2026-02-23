import { create } from "zustand";

interface TripState {
  origin: {
    name: string;
    latitude: number;
    longitude: number;
  } | null;

  destination: {
    name: string;
    latitude: number;
    longitude: number;
  } | null;

  distanceKm: number;
  durationMinutes: number;
  polyline: string | null;

  predictedArrivalPercent: number;

  recommendedCharger: any | null;

  tripActive: boolean;

  setTripData: (data: Partial<TripState>) => void;
  resetTrip: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  origin: null,
  destination: null,
  distanceKm: 0,
  durationMinutes: 0,
  polyline: null,
  predictedArrivalPercent: 0,
  recommendedCharger: null,
  tripActive: false,

  setTripData: (data) =>
    set((state) => ({
      ...state,
      ...data,
    })),

  resetTrip: () =>
    set({
      origin: null,
      destination: null,
      distanceKm: 0,
      durationMinutes: 0,
      polyline: null,
      predictedArrivalPercent: 0,
      recommendedCharger: null,
      tripActive: false,
    }),
}));