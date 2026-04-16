import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listChargersByHost,
  upsertCharger,
  getChargerById,
} from "../features/chargers/charger.repository";
import {
  createVerificationRequest,
  listVerificationRequestsByHost,
} from "../features/verification/verification.repository";
import type { UpsertChargerInput, Charger } from "../features/chargers/charger.types";
import type { VerificationRequest } from "../features/verification/verification.types";

export function useHostChargers(hostUserId?: string) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const chargersQuery = useQuery({
    queryKey: ["chargers", "host", hostUserId],
    queryFn: () => listChargersByHost(hostUserId!),
    enabled: Boolean(hostUserId),
  });

  const verificationsQuery = useQuery({
    queryKey: ["verifications", "host", hostUserId],
    queryFn: () => listVerificationRequestsByHost(hostUserId!),
    enabled: Boolean(hostUserId),
  });

  const chargers = useMemo(() => chargersQuery.data ?? [], [chargersQuery.data]);
  const verifications = useMemo(() => verificationsQuery.data ?? [], [verificationsQuery.data]);

  const verificationByCharger = useMemo(() => {
    const map: Record<string, VerificationRequest> = {};
    for (const v of verifications) map[v.chargerId] = v;
    return map;
  }, [verifications]);

  const saveMutation = useMutation({
    mutationFn: (input: { chargerId?: string; payload: UpsertChargerInput }) => {
      if (!hostUserId) return Promise.reject(new Error("Not authenticated"));
      return upsertCharger(input.chargerId || null, hostUserId, input.payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chargers", "host", hostUserId] });
    },
  });

  const reverifyMutation = useMutation({
    mutationFn: (charger: Charger) =>
      createVerificationRequest({
        chargerId: charger.id,
        hostUserId: charger.hostUserId,
        note: "Re-verification requested by host",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verifications"] });
    },
  });

  return {
    data: { chargers, verificationByCharger },
    isLoading: chargersQuery.isLoading,
    error: error || chargersQuery.error?.message || null,
    refresh: async () => {
      await Promise.all([chargersQuery.refetch(), verificationsQuery.refetch()]);
    },
    actions: {
      saveCharger: (input: { chargerId?: string; payload: UpsertChargerInput }) =>
        saveMutation.mutateAsync(input),
      requestReverification: (charger: Charger) => reverifyMutation.mutateAsync(charger),
      loadCharger: (chargerId: string) =>
        getChargerById(chargerId).then((c) => {
          if (!c) throw new Error("Charger not found");
          return c;
        }),
      setError,
    },
  };
}
