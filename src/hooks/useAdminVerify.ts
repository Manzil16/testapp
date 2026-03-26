import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { updateChargerStatus, type VerificationRubric } from "@/src/features/chargers/charger.repository";
import type { Charger } from "@/src/features/chargers/charger.types";
import type { UserProfile } from "@/src/features/users/user.types";

export interface PendingChargerWithHost {
  charger: Charger;
  host: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

function mapCharger(row: Record<string, unknown>): Charger {
  return {
    id: row.id as string,
    hostUserId: row.host_id as string,
    name: row.name as string,
    address: row.address as string,
    suburb: row.suburb as string,
    state: row.state as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    maxPowerKw: row.max_power_kw as number,
    pricingPerKwh: Number(row.price_per_kwh),
    connectors: (row.connectors as any[]) || [],
    amenities: (row.amenities as string[]) || [],
    availabilityNote: (row.availability_note as string) || "",
    availabilityWindow: row.availability_window as any,
    images: (row.images as string[]) || [],
    status: row.status as any,
    verificationScore: row.verification_score as number,
    createdAtIso: row.created_at as string,
    updatedAtIso: row.updated_at as string,
  };
}

export function useAdminVerify() {
  const queryClient = useQueryClient();

  const pendingQuery = useQuery({
    queryKey: ["admin-pending-chargers"],
    queryFn: async (): Promise<PendingChargerWithHost[]> => {
      const { data, error } = await supabase
        .from("chargers")
        .select(
          "*, host:profiles!host_id(id, display_name, avatar_url)"
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        charger: mapCharger(row),
        host: {
          id: row.host?.id ?? "",
          displayName: row.host?.display_name ?? "Unknown",
          avatarUrl: row.host?.avatar_url,
        },
      }));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (params: {
      chargerId: string;
      rubric: VerificationRubric;
      notes?: string;
    }) => {
      const score =
        params.rubric.photoQuality +
        params.rubric.plugVerified +
        params.rubric.locationAccuracy +
        params.rubric.hostResponse +
        params.rubric.adminReview;

      await updateChargerStatus(
        params.chargerId,
        "approved",
        score,
        params.rubric
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-chargers"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (params: { chargerId: string; reason: string }) => {
      await updateChargerStatus(params.chargerId, "rejected", 0);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-chargers"] });
    },
  });

  return {
    pendingChargers: pendingQuery.data ?? [],
    isLoading: pendingQuery.isLoading,
    refetch: pendingQuery.refetch,
    approveCharger: approveMutation.mutateAsync,
    rejectCharger: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
