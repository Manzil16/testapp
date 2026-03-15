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
  EmptyStateCard,
  NearbyChargerCard,
  PressableScale,
  ScreenContainer,
  SectionTitle,
  StatCardSkeleton,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useDriverDashboard, useEntranceAnimation, useRefresh } from "@/src/hooks";
import { useAuth } from "@/src/features/auth/auth-context";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DriverHomeScreen() {
  const router = useRouter();
  const { authUser, sessionUser, profile } = useAuth();
  const entranceStyle = useEntranceAnimation();

  const userId = useMemo(
    () => authUser?.uid || sessionUser?.uid,
    [authUser?.uid, sessionUser?.uid]
  );

  const { data, isLoading, error, refresh } = useDriverDashboard(userId);
  const { refreshing, onRefresh } = useRefresh(refresh);

  const activeBooking = data.activeBooking;
  const activeChargerName = activeBooking
    ? data.chargersById[activeBooking.chargerId]?.name || activeBooking.chargerId
    : "";

  const firstName = profile?.displayName?.split(" ")[0] || "Driver";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <FlatList
            data={[]}
            keyExtractor={(_, index) => String(index)}
            renderItem={() => null}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <View>
                {/* Hero Header */}
                <Animated.View entering={FadeIn.duration(400)}>
                  <LinearGradient
                    colors={["#1DB954", "#15803d"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroGradient}
                  >
                    <View style={styles.heroTop}>
                      <Avatar
                        uri={profile?.avatarUrl}
                        name={profile?.displayName || "User"}
                        size="lg"
                      />
                      <View style={styles.heroTextBlock}>
                        <Text style={styles.heroGreeting}>{getGreeting()},</Text>
                        <Text style={styles.heroName}>{firstName}</Text>
                      </View>
                    </View>

                    {/* Stats row inside hero */}
                    <View style={styles.heroStatsRow}>
                      {isLoading ? (
                        <View style={styles.heroStatsLoading}>
                          <Text style={styles.heroStatsLoadingText}>Loading...</Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.heroStatItem}>
                            <Text style={styles.heroStatValue}>{data.stats.totalTrips}</Text>
                            <Text style={styles.heroStatLabel}>Trips</Text>
                          </View>
                          <View style={styles.heroStatDivider} />
                          <View style={styles.heroStatItem}>
                            <Text style={styles.heroStatValue}>{data.stats.totalBookings}</Text>
                            <Text style={styles.heroStatLabel}>Bookings</Text>
                          </View>
                          <View style={styles.heroStatDivider} />
                          <View style={styles.heroStatItem}>
                            <Text style={styles.heroStatValue}>{data.stats.vehiclesRegistered}</Text>
                            <Text style={styles.heroStatLabel}>Vehicles</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </LinearGradient>
                </Animated.View>

                {/* Active Booking */}
                {activeBooking ? (
                  <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                    <PressableScale
                      style={styles.activeCard}
                      onPress={() =>
                        router.push(`/(app)/chargers/${activeBooking.chargerId}` as any)
                      }
                    >
                      <View style={styles.activePulse} />
                      <View style={styles.activeContent}>
                        <View style={styles.activeIconCircle}>
                          <Ionicons name="flash" size={20} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.activeLabel}>Active Session</Text>
                          <Text style={styles.activeName}>{activeChargerName}</Text>
                          <Text style={styles.activeTime}>
                            {new Date(activeBooking.startTimeIso).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                      </View>
                    </PressableScale>
                  </Animated.View>
                ) : (
                  <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                    <PressableScale
                      style={styles.discoverCard}
                      onPress={() => router.push("/(app)/(tabs)/discover" as any)}
                    >
                      <View style={styles.discoverIconCircle}>
                        <Ionicons name="search" size={22} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.discoverTitle}>Find your next charge</Text>
                        <Text style={styles.discoverSubtitle}>
                          Discover trusted chargers nearby
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
                    </PressableScale>
                  </Animated.View>
                )}

                {/* Quick Actions */}
                <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.actionsRow}>
                  {[
                    { icon: "search", label: "Discover", route: "/(app)/(tabs)/discover", color: Colors.primary, bg: Colors.primaryLight },
                    { icon: "map", label: "Plan Trip", route: "/(app)/(tabs)/trip", color: Colors.info, bg: Colors.infoLight },
                    { icon: "calendar", label: "Bookings", route: "/(app)/(tabs)/bookings", color: Colors.warning, bg: Colors.warningLight },
                    { icon: "person", label: "Profile", route: "/(app)/(tabs)/profile", color: "#8B5CF6", bg: "#EDE9FE" },
                  ].map((action) => (
                    <PressableScale
                      key={action.label}
                      onPress={() => router.push(action.route as any)}
                      style={styles.actionCard}
                    >
                      <View style={[styles.actionIconCircle, { backgroundColor: action.bg }]}>
                        <Ionicons name={action.icon as any} size={20} color={action.color} />
                      </View>
                      <Text style={styles.actionLabel}>{action.label}</Text>
                    </PressableScale>
                  ))}
                </Animated.View>

                {/* Nearby Chargers */}
                <Animated.View entering={FadeInDown.delay(300).duration(350)}>
                  <SectionTitle
                    title="Nearby Chargers"
                    subtitle="Quick picks around you"
                    actionLabel="See All"
                    onAction={() => router.push("/(app)/(tabs)/discover" as any)}
                  />
                </Animated.View>

                {error ? (
                  <EmptyStateCard
                    icon="⚠️"
                    title="Could not load dashboard"
                    message={error}
                    actionLabel="Retry"
                    onAction={refresh}
                  />
                ) : (
                  <FlatList
                    data={data.nearbyChargers}
                    horizontal
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.nearbyRow}
                    renderItem={({ item, index }) => (
                      <AnimatedListItem index={index}>
                        <NearbyChargerCard
                          name={item.name}
                          suburb={item.suburb}
                          powerKw={item.maxPowerKw}
                          pricePerKwh={item.pricingPerKwh}
                          onPress={() => router.push(`/(app)/chargers/${item.id}` as any)}
                        />
                      </AnimatedListItem>
                    )}
                    ListEmptyComponent={
                      isLoading ? null : (
                        <EmptyStateCard
                          icon="🗺️"
                          title="No nearby chargers yet"
                          message="Try refreshing or explore the map."
                          actionLabel="Open Explore"
                          onAction={() => router.push("/(app)/(tabs)/discover" as any)}
                        />
                      )
                    }
                  />
                )}
              </View>
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
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
  },
  heroName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  heroStatsLoading: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  heroStatsLoadingText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  heroStatItem: {
    flex: 1,
    alignItems: "center",
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  // Active booking
  activeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    marginBottom: Spacing.lg,
    overflow: "hidden",
    ...Shadows.card,
  },
  activePulse: {
    height: 3,
    backgroundColor: Colors.primary,
  },
  activeContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  activeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activeName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 2,
  },
  activeTime: {
    ...Typography.caption,
    marginTop: 2,
  },

  // Discover CTA
  discoverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  discoverIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  discoverTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  discoverSubtitle: {
    ...Typography.caption,
    marginTop: 2,
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
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  // Nearby
  nearbyRow: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
});
