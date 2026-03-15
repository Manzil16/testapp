import { useCallback, useEffect, useState } from "react";
import {
  listVehiclesByUser,
  listenToVehiclesByUser,
  upsertVehicle,
  type UpsertVehicleInput,
  type Vehicle,
} from "@/src/features/vehicles";

export function useVehicleProfile(userId?: string) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setVehicles([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const unsubscribe = listenToVehiclesByUser(
      userId,
      (items) => {
        setVehicles(items);
        setIsLoading(false);
      },
      (message) => {
        setError(message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setError(null);
      const result = await listVehiclesByUser(userId);
      setVehicles(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh vehicle profile.");
    }
  }, [userId]);

  const saveVehicle = useCallback(
    async (payload: UpsertVehicleInput, vehicleId?: string) => {
      if (!userId) {
        throw new Error("You must be signed in.");
      }

      const nextId = vehicleId || vehicles[0]?.id || `vehicle-${userId}`;
      await upsertVehicle(nextId, userId, payload);
      return nextId;
    },
    [userId, vehicles]
  );

  return {
    data: {
      vehicles,
      primaryVehicle: vehicles[0] || null,
    },
    isLoading,
    error,
    refresh,
    saveVehicle,
  };
}
