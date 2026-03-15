import { useCallback, useEffect, useState } from "react";
import {
  getChargerById,
  listenToHostChargers,
  upsertCharger,
  type Charger,
  type UpsertChargerInput,
} from "@/src/features/chargers";
import {
  createVerificationRequest,
  listVerificationRequestsByHost,
  type VerificationRequest,
} from "@/src/features/verification";

export function useHostChargers(hostUserId?: string) {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [verificationByCharger, setVerificationByCharger] = useState<
    Record<string, VerificationRequest>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostUserId) {
      setChargers([]);
      setVerificationByCharger({});
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const unsubscribe = listenToHostChargers(
      hostUserId,
      (items) => {
        setChargers(items);
        setIsLoading(false);

        // Load verification requests to show rejection reasons
        listVerificationRequestsByHost(hostUserId)
          .then((requests) => {
            const byCharger: Record<string, VerificationRequest> = {};
            for (const req of requests) {
              // Keep the most recent request per charger
              if (
                !byCharger[req.chargerId] ||
                req.updatedAtIso > byCharger[req.chargerId].updatedAtIso
              ) {
                byCharger[req.chargerId] = req;
              }
            }
            setVerificationByCharger(byCharger);
          })
          .catch(() => {
            // Non-critical — charger list still works without rejection reasons
          });
      },
      (message) => {
        setError(message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [hostUserId]);

  const refresh = useCallback(async () => {
    // Firestore listener keeps this hook synced; kept for API consistency.
    return;
  }, []);

  const saveCharger = useCallback(
    async (input: {
      chargerId?: string;
      payload: UpsertChargerInput;
    }) => {
      if (!hostUserId) {
        throw new Error("You must be signed in as host.");
      }

      const isNew = !input.chargerId;
      const nextId = input.chargerId || `charger-${hostUserId}-${Date.now()}`;
      const existingStatus =
        chargers.find((item) => item.id === nextId)?.status || "pending_verification";

      await upsertCharger(
        nextId,
        hostUserId,
        input.payload,
        isNew ? "pending_verification" : existingStatus
      );

      if (isNew) {
        await createVerificationRequest({
          chargerId: nextId,
          hostUserId,
          note: "Initial host submission",
        });
      }

      return nextId;
    },
    [chargers, hostUserId]
  );

  const requestReverification = useCallback(
    async (charger: Charger) => {
      if (!hostUserId) {
        throw new Error("You must be signed in as host.");
      }

      if (charger.status === "pending_verification") {
        throw new Error("This charger is already pending admin review.");
      }

      await createVerificationRequest({
        chargerId: charger.id,
        hostUserId,
        note: "Host requested re-verification",
      });
    },
    [hostUserId]
  );

  const loadCharger = useCallback(async (chargerId: string) => {
    return getChargerById(chargerId);
  }, []);

  return {
    data: {
      chargers,
      verificationByCharger,
    },
    isLoading,
    error,
    refresh,
    actions: {
      saveCharger,
      requestReverification,
      loadCharger,
      setError,
    },
  };
}
