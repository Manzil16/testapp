import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  EmptyStateCard,
  PressableScale,
  ScreenContainer,
  Colors,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { listNotificationsByUser } from "@/src/features/notifications/notification.repository";
import { useBadgeCounts } from "@/src/hooks";

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { markNotificationsSeen, markChargerUpdatesSeen } = useBadgeCounts();

  const userId = useMemo(() => user?.id, [user?.id]);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => listNotificationsByUser(userId!),
    enabled: Boolean(userId),
  });

  useFocusEffect(
    useCallback(() => {
      void markNotificationsSeen();
    }, [markNotificationsSeen])
  );

  const notifications = notificationsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer scrollable={false}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>Recent platform updates and alerts.</Text>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const chargerId = item.metadata?.chargerId;

            return (
              <PressableScale
                style={styles.card}
                onPress={() => {
                  if (!chargerId) return;
                  void markChargerUpdatesSeen();
                  router.push(`/(app)/chargers/${chargerId}?fromBadge=chargerUpdates` as any);
                }}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={chargerId ? "flash-outline" : "notifications-outline"}
                    size={18}
                    color={Colors.accent}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardText}>{item.body}</Text>
                  <Text style={styles.cardTime}>
                    {new Date(item.createdAtIso).toLocaleString()}
                  </Text>
                </View>
              </PressableScale>
            );
          }}
          ListEmptyComponent={
            notificationsQuery.isLoading ? null : (
              <EmptyStateCard
                icon="🔔"
                title="No notifications"
                message="You are all caught up."
              />
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
  title: {
    ...Typography.pageTitle,
  },
  subtitle: {
    ...Typography.body,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  list: {
    paddingBottom: Spacing.xxxl,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentLight,
    marginTop: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.cardTitle,
  },
  cardText: {
    ...Typography.body,
    marginTop: 2,
  },
  cardTime: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
});
