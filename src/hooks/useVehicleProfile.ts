import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listVehiclesByUser,
  upsertVehicle,
} from "../features/vehicles/vehicle.repository";
import type { UpsertVehicleInput } from "../features/vehicles/vehicle.types";

export function useVehicleProfile(userId?: string) {
  const queryClient = useQueryClient();

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", userId],
    queryFn: () => listVehiclesByUser(userId!),
    enabled: Boolean(userId),
  });

  const vehicles = vehiclesQuery.data ?? [];
  const primaryVehicle = vehicles[0] ?? null;

  const saveMutation = useMutation({
    mutationFn: (input: { payload: UpsertVehicleInput; vehicleId?: string }) =>
      upsertVehicle(input.vehicleId || null, userId!, input.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", userId] });
    },
  });

  return {
    data: { vehicles, primaryVehicle },
    isLoading: vehiclesQuery.isLoading,
    error: vehiclesQuery.error?.message || null,
    refresh: async () => {
      await vehiclesQuery.refetch();
    },
    saveVehicle: (payload: UpsertVehicleInput, vehicleId?: string) =>
      saveMutation.mutateAsync({ payload, vehicleId }),
  };
}
