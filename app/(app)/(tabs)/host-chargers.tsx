import { useMemo } from "react";
import { useRouter } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  AnimatedListItem,
  ChargerCardSkeleton,
  EmptyStateCard,
  PressableScale,
  ScreenContainer,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { useHostChargers, useEntranceAnimation, useRefresh } from "@/src/hooks";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  approved: { color: Colors.success, bg: Colors.successLight, label: "Approved", icon: "checkmark-circle" },
  pending: { color: Colors.warning, bg: Colors.warningLight, label: "Pending", icon: "time" },
  rejected: { color: Colors.error, bg: Colors.errorLight, label: "Rejected", icon: "close-circle" },
};

export default function HostChargersTabScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const entranceStyle = useEntranceAnimation();

  const userId = useMemo(
    () => user?.id,
    [user?.id]
  );

  const { data, isLoading, error, refresh, actions } = useHostChargers(userId);
  const { refreshing, onRefresh } = useRefresh(refresh);

  if (!profile?.isHost) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          {/* Header */}
          <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>My Chargers</Text>
              <Text style={styles.pageSubtitle}>
                {data.chargers.length} listing{data.chargers.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <PressableScale
              onPress={() => router.push("/(app)/host/charger-form" as any)}
              style={styles.addButton}
            >
              <Ionicons name="add" size={20} color={Colors.textInverse} />
              <Text style={styles.addButtonText}>Add</Text>
            </PressableScale>
          </Animated.View>

          {error ? (
            <EmptyStateCard
              icon="⚠️"
              title="Unable to load chargers"
              message={error}
              actionLabel="Retry"
              onAction={refresh}
            />
          ) : null}

          {isLoading ? (
            <View style={styles.skeletons}>
              <ChargerCardSkeleton />
              <ChargerCardSkeleton />
            </View>
          ) : (
            <FlatList
              data={data.chargers}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00BFA5" />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const verificationReq = data.verificationByCharger[item.id];
                const rejectionNote =
                  item.status === "rejected" && verificationReq?.status === "rejected"
                    ? verificationReq.note
                    : null;

                const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                const canRequestReview = item.status === "rejected";

                return (
                  <AnimatedListItem index={index}>
                    <PressableScale
                      style={styles.card}
                      onPress={() => router.push(`/(app)/host/charger-form?chargerId=${item.id}` as any)}
                    >
                      {/* Status accent line */}
                      <View style={[styles.statusAccent, { backgroundColor: statusCfg.color }]} />

                      <View style={styles.cardBody}>
                        {/* Top row */}
                        <View style={styles.cardTop}>
                          <View style={styles.chargerIconCircle}>
                            <Ionicons name="flash" size={18} color={Colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.chargerName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.chargerLocation}>
                              {item.suburb}, {item.state}
                            </Text>
                          </View>
                          <View style={[styles.statusChip, { backgroundColor: statusCfg.bg }]}>
                            <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
                            <Text style={[styles.statusChipText, { color: statusCfg.color }]}>
                              {statusCfg.label}
                            </Text>
                          </View>
                        </View>

                        {/* Specs row */}
                        <View style={styles.specsRow}>
                          <View style={styles.specItem}>
                            <Ionicons name="speedometer-outline" size={14} color={Colors.textMuted} />
                            <Text style={styles.specText}>{item.maxPowerKw} kW</Text>
                          </View>
                          <View style={styles.specDot} />
                          <View style={styles.specItem}>
                            <Ionicons name="pricetag-outline" size={14} color={Colors.textMuted} />
                            <Text style={styles.specText}>${item.pricingPerKwh}/kWh</Text>
                          </View>
                          <View style={styles.specDot} />
                          <View style={styles.specItem}>
                            <Ionicons name="hardware-chip-outline" size={14} color={Colors.textMuted} />
                            <Text style={styles.specText}>
                              {item.connectors.map((c) => c.type).join(", ")}
                            </Text>
                          </View>
                        </View>

                        {/* Rejection feedback */}
                        {rejectionNote ? (
                          <View style={styles.rejectionBanner}>
                            <Ionicons name="information-circle" size={16} color={Colors.error} />
                            <Text style={styles.rejectionText}>{rejectionNote}</Text>
                          </View>
                        ) : null}

                        {/* Actions */}
                        <View style={styles.actionRow}>
                          <PressableScale
                            onPress={() =>
                              router.push(`/(app)/host/charger-form?chargerId=${item.id}` as any)
                            }
                            style={styles.editBtn}
                          >
                            <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                            <Text style={styles.editBtnText}>Edit</Text>
                          </PressableScale>

                          {canRequestReview && (
                            <PressableScale
                              onPress={() => actions.requestReverification(item)}
                              style={styles.reviewBtn}
                            >
                              <Ionicons name="refresh" size={16} color={Colors.primary} />
                              <Text style={styles.reviewBtnText}>Request Review</Text>
                            </PressableScale>
                          )}
                        </View>
                      </View>
                    </PressableScale>
                  </AnimatedListItem>
                );
              }}
              ListEmptyComponent={
                <EmptyStateCard
                  icon="⚡"
                  title="No chargers yet"
                  message="Create your first charger listing to accept bookings."
                  actionLabel="Add Charger"
                  onAction={() => router.push("/(app)/host/charger-form" as any)}
                />
              }
            />
          )}
        </ScreenContainer>
      </Animated.View>
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
    marginBottom: Spacing.lg,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    ...Shadows.button,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textInverse,
  },
  skeletons: {
    gap: Spacing.sm,
  },
  listContent: {
    paddingBottom: Spacing.xxxl + 20,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
    overflow: "hidden",
    ...Shadows.card,
  },
  statusAccent: {
    height: 3,
    width: "100%",
  },
  cardBody: {
    padding: Spacing.lg,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  chargerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  chargerName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  chargerLocation: {
    ...Typography.caption,
    marginTop: 1,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Specs
  specsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  specText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  specDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },

  // Rejection
  rejectionBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  rejectionText: {
    ...Typography.caption,
    color: Colors.error,
    flex: 1,
    lineHeight: 16,
  },

  // Actions
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  reviewBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
});
