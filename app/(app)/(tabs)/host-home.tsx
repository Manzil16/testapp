import { useMemo } from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  AnimatedListItem,
  Avatar,
  ChargerStatusBadge,
  EmptyStateCard,
  PressableScale,
  ScreenContainer,
  SectionTitle,
  StatCardSkeleton,
  Typography,
  Colors,
  Spacing,
  Radius,
  Shadows,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { useHostDashboard, useEntranceAnimation, useRefresh } from "@/src/hooks";

export default function HostHomeTabScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const userId = useMemo(
    () => user?.id,
    [user?.id]
  );

  const { data, isLoading, error, refresh } = useHostDashboard(userId);
  const { refreshing, onRefresh } = useRefresh(refresh);

  const firstName = profile?.displayName?.split(" ")[0] || "Host";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <FlatList
            data={data.chargers}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00BFA5" />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <View>
                {/* Hero Header */}
                <Animated.View entering={FadeIn.duration(400)}>
                  <LinearGradient
                    colors={Colors.gradientHero as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroGradient}
                  >
                    <View style={styles.heroTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.heroWelcome}>Welcome back,</Text>
                        <Text style={styles.heroName}>{firstName}</Text>
                      </View>
                      <Avatar uri={profile?.avatarUrl} name={profile?.displayName || "Host"} size="lg" />
                    </View>

                    {/* Earnings spotlight */}
                    <View style={styles.earningsRow}>
                      <View>
                        <Text style={styles.earningsLabel}>This month</Text>
                        <Text style={styles.earningsValue}>
                          ${data.estimatedRevenue.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.earningsDivider} />
                      <View style={styles.miniStatCol}>
                        <Text style={styles.miniStatValue}>{data.stats.totalChargers}</Text>
                        <Text style={styles.miniStatLabel}>Chargers</Text>
                      </View>
                      <View style={styles.miniStatCol}>
                        <Text style={styles.miniStatValue}>{data.stats.activeSessions}</Text>
                        <Text style={styles.miniStatLabel}>Active</Text>
                      </View>
                      <View style={styles.miniStatCol}>
                        <Text style={styles.miniStatValue}>{data.stats.completedThisMonth}</Text>
                        <Text style={styles.miniStatLabel}>Done</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Animated.View>

                {/* Quick Actions */}
                <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.actionsRow}>
                  <PressableScale
                    onPress={() => router.push("/(app)/host/charger-form" as any)}
                    style={styles.actionCard}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: Colors.primaryLight }]}>
                      <Ionicons name="add-circle" size={22} color={Colors.primary} />
                    </View>
                    <Text style={styles.actionLabel}>Add Charger</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={() => router.push("/(app)/(tabs)/host-bookings" as any)}
                    style={styles.actionCard}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: Colors.warningLight }]}>
                      <Ionicons name="calendar" size={20} color={Colors.warning} />
                    </View>
                    <Text style={styles.actionLabel}>Bookings</Text>
                    {data.stats.pendingBookings > 0 && (
                      <View style={styles.actionBadge}>
                        <Text style={styles.actionBadgeText}>{data.stats.pendingBookings}</Text>
                      </View>
                    )}
                  </PressableScale>
                  <PressableScale
                    onPress={() => router.push("/(app)/(tabs)/host-chargers" as any)}
                    style={styles.actionCard}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: Colors.infoLight }]}>
                      <Ionicons name="flash" size={20} color={Colors.info} />
                    </View>
                    <Text style={styles.actionLabel}>Chargers</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={() => router.push("/(app)/host/analytics" as any)}
                    style={styles.actionCard}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: Colors.successLight }]}>
                      <Ionicons name="bar-chart" size={20} color={Colors.success} />
                    </View>
                    <Text style={styles.actionLabel}>Analytics</Text>
                  </PressableScale>
                </Animated.View>

                {/* Pending Bookings */}
                {data.pendingBookings.length > 0 && (
                  <Animated.View entering={FadeInDown.delay(200).duration(350)}>
                    <SectionTitle title="Needs Attention" />
                    <View style={styles.pendingList}>
                      {data.pendingBookings.slice(0, 3).map((booking, index) => (
                        <AnimatedListItem key={booking.id} index={index}>
                          <PressableScale
                            style={styles.pendingCard}
                            onPress={() => router.push("/(app)/(tabs)/host-bookings" as any)}
                          >
                            <View style={styles.pendingDot} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.pendingTitle}>
                                New booking request
                              </Text>
                              <Text style={styles.pendingMeta}>
                                {booking.estimatedKWh} kWh requested
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                          </PressableScale>
                        </AnimatedListItem>
                      ))}
                    </View>
                  </Animated.View>
                )}

                {/* Your Chargers Header */}
                <Animated.View entering={FadeInDown.delay(300).duration(350)}>
                  <SectionTitle
                    title="Your Chargers"
                    actionLabel={data.chargers.length > 0 ? "Manage" : undefined}
                    onAction={() => router.push("/(app)/(tabs)/host-chargers" as any)}
                  />
                </Animated.View>

                {error ? (
                  <EmptyStateCard
                    icon="⚠️"
                    title="Could not load host data"
                    message={error}
                    actionLabel="Retry"
                    onAction={refresh}
                  />
                ) : null}

                {isLoading ? (
                  <View style={styles.skeletonRow}>
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </View>
                ) : null}
              </View>
            }
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index}>
                <PressableScale
                  style={styles.chargerCard}
                  onPress={() =>
                    router.push(`/(app)/host/charger-form?chargerId=${item.id}` as any)
                  }
                >
                  <View style={styles.chargerIconCol}>
                    <View style={styles.chargerIconCircle}>
                      <Ionicons name="flash" size={18} color={Colors.primary} />
                    </View>
                  </View>
                  <View style={styles.chargerInfo}>
                    <Text style={styles.chargerName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.chargerMeta}>
                      {item.suburb}, {item.state} · {item.maxPowerKw} kW
                    </Text>
                  </View>
                  <ChargerStatusBadge status={item.status === "approved" ? "online" : item.status} />
                </PressableScale>
              </AnimatedListItem>
            )}
            ListEmptyComponent={
              isLoading ? null : (
                <EmptyStateCard
                  icon="⚡"
                  title="No chargers listed"
                  message="Create your first charger listing to start earning."
                  actionLabel="Add Charger"
                  onAction={() => router.push("/(app)/host/charger-form" as any)}
                />
              )
            }
          />
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
  content: {
    paddingBottom: Spacing.xxxl + 20,
  },

  // Hero
  heroGradient: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  heroWelcome: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
  },
  heroName: {
    ...Typography.pageTitle,
    color: Colors.textInverse,
    letterSpacing: -0.5,
  },
  earningsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  earningsLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  earningsValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  earningsDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  miniStatCol: {
    alignItems: "center",
    flex: 1,
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  // Quick Actions
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadows.card,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  actionBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.error,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFF",
  },

  // Pending
  pendingList: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    ...Shadows.card,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  pendingTitle: {
    ...Typography.cardTitle,
  },
  pendingMeta: {
    ...Typography.caption,
    marginTop: 2,
  },

  // Charger cards
  chargerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    ...Shadows.card,
  },
  chargerIconCol: {
    alignItems: "center",
  },
  chargerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  chargerInfo: {
    flex: 1,
  },
  chargerName: {
    ...Typography.cardTitle,
  },
  chargerMeta: {
    ...Typography.caption,
    marginTop: 2,
  },

  skeletonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
