import { useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotificationsByUser } from "../features/notifications/notification.repository";
import { listBookingsByDriver } from "../features/bookings/booking.repository";
import { listReviewsByDriver } from "../features/reviews/review.repository";
import { useAuth } from "../features/auth/auth-context";

const KEYS = {
  notifications: "last_seen_notifications",
  sessions: "last_seen_sessions",
  profile: "last_seen_profile",
  chargerUpdates: "last_seen_chargerUpdates",
} as const;

type BadgeType = keyof typeof KEYS;

interface SeenState {
  notifications: string | null;
  sessions: string | null;
  profile: string | null;
  chargerUpdates: string | null;
}

const DEFAULT_SEEN: SeenState = {
  notifications: null,
  sessions: null,
  profile: null,
  chargerUpdates: null,
};

export interface BadgeCounts {
  total: number;
  sessions: number;
  messages: number;
  chargerUpdates: number;
  profile: number;
}

export interface BadgeTargets {
  profileMissingField: "avatar" | "phone" | null;
  chargerUpdateChargerId: string | null;
}

function isAfterSeen(iso: string, seenIso: string | null) {
  return !seenIso || iso > seenIso;
}

export function useBadgeCounts() {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const hasProfile = Boolean(profile);
  const profileAvatarUrl = profile?.avatarUrl;
  const profilePhone = profile?.phone;
  const profileUpdatedAtIso = profile?.updatedAtIso;

  const seenQuery = useQuery({
    queryKey: ["badge-seen", userId],
    queryFn: async (): Promise<SeenState> => {
      const [notifications, sessions, profileSeen, chargerUpdates] = await Promise.all([
        AsyncStorage.getItem(KEYS.notifications),
        AsyncStorage.getItem(KEYS.sessions),
        AsyncStorage.getItem(KEYS.profile),
        AsyncStorage.getItem(KEYS.chargerUpdates),
      ]);

      return {
        notifications,
        sessions,
        profile: profileSeen,
        chargerUpdates,
      };
    },
    enabled: Boolean(userId),
    staleTime: Infinity,
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => listNotificationsByUser(userId!),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "driver", userId],
    queryFn: () => listBookingsByDriver(userId!),
    enabled: Boolean(userId),
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews", "driver", userId],
    queryFn: () => listReviewsByDriver(userId!),
    enabled: Boolean(userId),
  });

  const seen = seenQuery.data ?? DEFAULT_SEEN;

  const targets = useMemo<BadgeTargets>(() => {
    const notifications = notificationsQuery.data ?? [];

    const chargerUpdateChargerId =
      notifications.find(
        (n) =>
          (n.type === "verification" || n.type === "system") &&
          Boolean(n.metadata?.chargerId) &&
          isAfterSeen(n.createdAtIso, seen.chargerUpdates)
      )?.metadata?.chargerId ??
      notifications.find(
        (n) =>
          (n.type === "verification" || n.type === "system") &&
          Boolean(n.metadata?.chargerId)
      )?.metadata?.chargerId ??
      null;

    const profileMissingField: "avatar" | "phone" | null = !hasProfile
      ? null
      : !profileAvatarUrl
      ? "avatar"
      : !profilePhone
      ? "phone"
      : null;

    return {
      profileMissingField,
      chargerUpdateChargerId,
    };
  }, [hasProfile, notificationsQuery.data, profileAvatarUrl, profilePhone, seen.chargerUpdates]);

  const counts = useMemo<BadgeCounts>(() => {
    const notifications = notificationsQuery.data ?? [];
    const bookings = bookingsQuery.data ?? [];
    const reviews = reviewsQuery.data ?? [];

    const reviewedBookingIds = new Set(reviews.map((review) => review.bookingId));

    const completedUnrated = bookings.filter(
      (b) =>
        b.status === "completed" &&
        !reviewedBookingIds.has(b.id) &&
        isAfterSeen(b.updatedAtIso, seen.sessions)
    ).length;

    const profileIncomplete = hasProfile && targets.profileMissingField
      ? isAfterSeen(profileUpdatedAtIso || new Date().toISOString(), seen.profile)
        ? 1
        : 0
      : 0;

    const chargerNotifs = notifications.filter(
      (n) =>
        (n.type === "verification" || n.type === "system") &&
        Boolean(n.metadata?.chargerId) &&
        isAfterSeen(n.createdAtIso, seen.chargerUpdates)
    ).length;

    const unreadNotifs = notifications.filter(
      (n) =>
        isAfterSeen(n.createdAtIso, seen.notifications) &&
        !((n.type === "verification" || n.type === "system") && Boolean(n.metadata?.chargerId))
    ).length;

    const sessions = completedUnrated;
    const messages = unreadNotifs;
    const chargerUpdates = chargerNotifs;

    return {
      total: sessions + messages + chargerUpdates + profileIncomplete,
      sessions,
      messages,
      chargerUpdates,
      profile: profileIncomplete,
    };
  }, [
    bookingsQuery.data,
    hasProfile,
    notificationsQuery.data,
    profileUpdatedAtIso,
    reviewsQuery.data,
    seen,
    targets.profileMissingField,
  ]);

  const setSeen = useCallback(
    async (type: BadgeType) => {
      if (!userId) return;
      const now = new Date().toISOString();
      await AsyncStorage.setItem(KEYS[type], now);

      queryClient.setQueryData<SeenState>(["badge-seen", userId], (current) => ({
        ...DEFAULT_SEEN,
        ...(current ?? {}),
        [type]: now,
      }));
    },
    [queryClient, userId]
  );

  const markNotificationsSeen = useCallback(async () => {
    await setSeen("notifications");
  }, [setSeen]);

  const markSessionsSeen = useCallback(async () => {
    await setSeen("sessions");
  }, [setSeen]);

  const markProfileSeen = useCallback(async () => {
    await setSeen("profile");
  }, [setSeen]);

  const markChargerUpdatesSeen = useCallback(async () => {
    await setSeen("chargerUpdates");
  }, [setSeen]);

  return {
    counts,
    targets,
    markNotificationsSeen,
    markSessionsSeen,
    markProfileSeen,
    markChargerUpdatesSeen,
    clearNotifications: markNotificationsSeen,
    clearBookings: markSessionsSeen,
    clearProfile: markProfileSeen,
    clearChargerUpdates: markChargerUpdatesSeen,
  };
}
