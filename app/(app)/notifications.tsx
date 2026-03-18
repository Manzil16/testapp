import { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  AnimatedListItem,
  EmptyStateCard,
  InfoPill,
  PressableScale,
  ScreenContainer,
  SegmentedControl,
  Colors,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import {
  listNotificationsByUser,
  markNotificationRead,
} from "@/src/features/notifications/notification.repository";
import { useBadgeCounts, useRefresh } from "@/src/hooks";
import type { AppNotification } from "@/src/features/notifications/notification.types";

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  booking: "calendar",
  verification: "shield-checkmark",
  trip: "map",
  system: "megaphone",
};

const COLOR_MAP: Record<string, string> = {
  booking: Colors.info,
  verification: Colors.warning,
  trip: Colors.primary,
  system: Colors.error,
};

const BG_MAP: Record<string, string> = {
  booking: Colors.infoLight,
  verification: Colors.warningLight,
  trip: Colors.primaryLight,
  system: Colors.errorLight,
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { markNotificationsSeen, markChargerUpdatesSeen } = useBadgeCounts();

  const userId = useMemo(() => user?.id, [user?.id]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const notificationsQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => listNotificationsByUser(userId!),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });

  const notifications = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);

  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    return notifications;
  }, [notifications, filter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const { refreshing, onRefresh } = useRefresh(async () => {
    await notificationsQuery.refetch();
  });

  useFocusEffect(
    useCallback(() => {
      void markNotificationsSeen();
    }, [markNotificationsSeen])
  );

  const handlePress = async (item: AppNotification) => {
    if (!item.isRead) {
      await markNotificationRead(item.id);
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    }

    const chargerId = item.metadata?.chargerId;
    const bookingId = item.metadata?.bookingId;

    if (chargerId) {
      void markChargerUpdatesSeen();
      router.push(`/(app)/chargers/${chargerId}?fromBadge=chargerUpdates` as any);
    } else if (bookingId) {
      router.push("/(app)/(tabs)/bookings" as any);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenContainer scrollable={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={Typography.pageTitle}>Notifications</Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <SegmentedControl
          segments={[
            { id: "all", label: "All" },
            { id: "unread", label: `Unread (${unreadCount})` },
          ]}
          activeId={filter}
          onChange={(id) => setFilter(id as any)}
          style={styles.segmented}
        />

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <PressableScale
                style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
                onPress={() => handlePress(item)}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: BG_MAP[item.type] || Colors.surfaceAlt },
                  ]}
                >
                  <Ionicons
                    name={ICON_MAP[item.type] || "notifications"}
                    size={20}
                    color={COLOR_MAP[item.type] || Colors.textMuted}
                  />
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifTitleRow}>
                    <Text
                      style={[styles.notifTitle, !item.isRead && styles.notifTitleBold]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>
                    {item.body}
                  </Text>
                  <View style={styles.notifMeta}>
                    <Text style={styles.notifTime}>{formatTimeAgo(item.createdAtIso)}</Text>
                    <InfoPill label={item.type} variant="default" />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </PressableScale>
            </AnimatedListItem>
          )}
          ListEmptyComponent={
            notificationsQuery.isLoading ? null : (
              <Animated.View entering={FadeInDown.duration(300)}>
                <EmptyStateCard
                  icon="🔔"
                  title="All caught up"
                  message="No notifications yet. We'll let you know when something happens."
                />
              </Animated.View>
            )
          }
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  countBadge: {
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  countText: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: "700",
  },
  segmented: {
    marginBottom: Spacing.md,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    ...Shadows.subtle,
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    ...Shadows.card,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  notifContent: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  notifTitle: {
    ...Typography.cardTitle,
    flex: 1,
  },
  notifTitleBold: {
    fontWeight: "700",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  notifBody: {
    ...Typography.body,
    marginTop: 2,
  },
  notifMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  notifTime: {
    ...Typography.caption,
  },
});
