import { useMemo } from "react";
import { useRouter } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  AnimatedListItem,
  Avatar,
  EmptyStateCard,
  InfoPill,
  NearbyChargerCard,
  PressableScale,
  ScreenContainer,
  SectionTitle,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import {
  useDriverDashboard,
  useEntranceAnimation,
  useRefresh,
  useAnnouncements,
  useBadgeCounts,
  useEngagement,
} from "@/src/hooks";
import { useAuth } from "@/src/features/auth/auth-context";
import { formatDistance } from "@/src/hooks/useUserLocation";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const ANNOUNCEMENT_COLORS: Record<
  string,
  { bg: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  info: {
    bg: Colors.infoLight,
    icon: "information-circle",
    color: Colors.info,
  },
  warning: {
    bg: Colors.warningLight,
    icon: "alert-circle",
    color: Colors.warning,
  },
  promo: { bg: Colors.primaryLight, icon: "gift", color: Colors.primary },
};

export default function DriverHomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const { announcements } = useAnnouncements();
  const { counts } = useBadgeCounts();

  const userId = useMemo(() => user?.id, [user?.id]);

  const { data, isLoading, error, refresh } = useDriverDashboard(userId);
  const { refreshing, onRefresh } = useRefresh(refresh);
  const { nudges, streak } = useEngagement(data.stats);

  const activeBooking = data.activeBooking;
  const activeChargerName = activeBooking
    ? data.chargersById[activeBooking.chargerId]?.name ||
      activeBooking.chargerId
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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#00BFA5"
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <View>
                {/* Hero Header */}
                <Animated.View entering={FadeIn.duration(400)}>
                  <LinearGradient
                    colors={[...Colors.gradientHero]}
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
                        <Text style={styles.heroGreeting}>
                          {getGreeting()},
                        </Text>
                        <Text style={styles.heroName}>{firstName}</Text>
                      </View>
                      <PressableScale
                        onPress={() =>
                          router.push("/(app)/notifications" as any)
                        }
                        style={styles.notifBtn}
                      >
                        <Ionicons
                          name="notifications-outline"
                          size={22}
                          color="#FFFFFF"
                        />
                        {counts.unreadNotifications > 0 && (
                          <View style={styles.notifBadge}>
                            <Text style={styles.notifBadgeText}>
                              {counts.unreadNotifications > 9
                                ? "9+"
                                : counts.unreadNotifications}
                            </Text>
                          </View>
                        )}
                      </PressableScale>
                    </View>

                    {/* Stats row */}
                    <View style={styles.heroStatsRow}>
                      {isLoading ? (
                        <View style={styles.heroStatsLoading}>
                          <Text style={styles.heroStatsLoadingText}>
                            Loading...
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.heroStatItem}>
                            <Text style={styles.heroStatValue}>
                              {data.stats.totalTrips}
                            </Text>
                            <Text style={styles.heroStatLabel}>Trips</Text>
                          </View>
                          <View style={styles.heroStatDivider} />
                          <View style={styles.heroStatItem}>
                            <Text style={styles.heroStatValue}>
                              {data.stats.totalBookings}
                            </Text>
                            <Text style={styles.heroStatLabel}>Bookings</Text>
                          </View>
                          <View style={styles.heroStatDivider} />
                          <View style={styles.heroStatItem}>
                            <Text style={styles.heroStatValue}>
                              {data.stats.vehiclesRegistered}
                            </Text>
                            <Text style={styles.heroStatLabel}>Vehicles</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </LinearGradient>
                </Animated.View>

                {/* Announcement Banner */}
                {announcements.length > 0 && (
                  <Animated.View entering={FadeInDown.delay(50).duration(350)}>
                    {announcements.map((ann) => {
                      const config =
                        ANNOUNCEMENT_COLORS[ann.type] ||
                        ANNOUNCEMENT_COLORS.info;
                      return (
                        <View
                          key={ann.id}
                          style={[
                            styles.announcementBanner,
                            { backgroundColor: config.bg },
                          ]}
                        >
                          <Ionicons
                            name={config.icon}
                            size={20}
                            color={config.color}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.announcementTitle,
                                { color: config.color },
                              ]}
                            >
                              {ann.title}
                            </Text>
                            <Text style={styles.announcementBody}>
                              {ann.body}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </Animated.View>
                )}

                {/* Active Booking with live pulse */}
                {activeBooking ? (
                  <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                    <PressableScale
                      style={styles.activeCard}
                      onPress={() =>
                        router.push("/(app)/(tabs)/bookings" as any)
                      }
                    >
                      {activeBooking.status === "active" && (
                        <View style={styles.activePulse} />
                      )}
                      <View style={styles.activeContent}>
                        <View style={styles.activeIconCircle}>
                          <Ionicons
                            name={
                              activeBooking.status === "active"
                                ? "flash"
                                : activeBooking.status === "approved"
                                  ? "checkmark-circle"
                                  : "time"
                            }
                            size={20}
                            color={Colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.activeLabelRow}>
                            <Text
                              style={
                                activeBooking.status === "requested"
                                  ? styles.activeLabel
                                  : styles.pendingApprovalLabel
                              }
                            >
                              {activeBooking.status === "active"
                                ? "Charging"
                                : activeBooking.status === "approved"
                                  ? "Booking Approved"
                                  : "Pending Approval"}
                            </Text>
                            {activeBooking.status === "active" && (
                              <>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                              </>
                            )}
                          </View>
                          <Text style={styles.activeName}>
                            {activeChargerName}
                          </Text>
                          <Text style={styles.activeTime}>
                            {new Date(
                              activeBooking.startTimeIso,
                            ).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" — "}
                            {new Date(
                              activeBooking.endTimeIso,
                            ).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={Colors.textMuted}
                        />
                      </View>
                    </PressableScale>
                  </Animated.View>
                ) : (
                  <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                    <PressableScale
                      style={styles.discoverCard}
                      onPress={() =>
                        router.push("/(app)/(tabs)/discover" as any)
                      }
                    >
                      <View style={styles.discoverIconCircle}>
                        <Ionicons
                          name="search"
                          size={22}
                          color={Colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.discoverTitle}>
                          Find your next charge
                        </Text>
                        <Text style={styles.discoverSubtitle}>
                          Discover trusted chargers nearby
                        </Text>
                      </View>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={Colors.primary}
                      />
                    </PressableScale>
                  </Animated.View>
                )}

                {/* Nearest Charger Shortcut */}
                {data.nearestCharger && !activeBooking && (
                  <Animated.View entering={FadeInDown.delay(150).duration(350)}>
                    <PressableScale
                      style={styles.nearestCard}
                      onPress={() =>
                        router.push(
                          `/(app)/chargers/${data.nearestCharger!.id}` as any,
                        )
                      }
                    >
                      <View style={styles.nearestIcon}>
                        <Ionicons
                          name="navigate"
                          size={18}
                          color={Colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nearestTitle}>Nearest Charger</Text>
                        <Text style={styles.nearestName}>
                          {data.nearestCharger.name}
                        </Text>
                      </View>
                      {data.nearestCharger.distanceKm !== null && (
                        <InfoPill
                          label={formatDistance(data.nearestCharger.distanceKm)}
                          variant="primary"
                        />
                      )}
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={Colors.textMuted}
                      />
                    </PressableScale>
                  </Animated.View>
                )}

                {/* Quick Actions */}
                <Animated.View
                  entering={FadeInDown.delay(200).duration(350)}
                  style={styles.actionsRow}
                >
                  {[
                    {
                      icon: "search",
                      label: "Discover",
                      route: "/(app)/(tabs)/discover",
                      color: Colors.primary,
                      bg: Colors.primaryLight,
                    },
                    {
                      icon: "map",
                      label: "Plan Trip",
                      route: "/(app)/(tabs)/trip",
                      color: Colors.info,
                      bg: Colors.infoLight,
                    },
                    {
                      icon: "calendar",
                      label: "Bookings",
                      route: "/(app)/(tabs)/bookings",
                      color: Colors.warning,
                      bg: Colors.warningLight,
                    },
                    {
                      icon: "person",
                      label: "Profile",
                      route: "/(app)/(tabs)/profile",
                      color: Colors.info,
                      bg: Colors.infoLight,
                    },
                  ].map((action) => (
                    <PressableScale
                      key={action.label}
                      onPress={() => router.push(action.route as any)}
                      style={styles.actionCard}
                    >
                      <View
                        style={[
                          styles.actionIconCircle,
                          { backgroundColor: action.bg },
                        ]}
                      >
                        <Ionicons
                          name={action.icon as any}
                          size={20}
                          color={action.color}
                        />
                      </View>
                      <Text style={styles.actionLabel}>{action.label}</Text>
                    </PressableScale>
                  ))}
                </Animated.View>

                {/* Engagement Nudges */}
                {nudges.length > 0 && (
                  <Animated.View entering={FadeInDown.delay(250).duration(350)}>
                    {nudges.map((nudge) => (
                      <PressableScale
                        key={nudge.id}
                        style={styles.nudgeCard}
                        onPress={() => {
                          if (
                            nudge.id === "first-booking" ||
                            nudge.id === "morning" ||
                            nudge.id === "evening"
                          ) {
                            router.push("/(app)/(tabs)/discover" as any);
                          } else if (nudge.id === "add-vehicle") {
                            router.push("/(app)/driver/vehicle" as any);
                          }
                        }}
                      >
                        <View style={styles.nudgeIconCircle}>
                          <Ionicons
                            name={nudge.icon as any}
                            size={18}
                            color={Colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.nudgeTitle}>{nudge.title}</Text>
                          <Text style={styles.nudgeSubtitle}>
                            {nudge.subtitle}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={Colors.textMuted}
                        />
                      </PressableScale>
                    ))}
                  </Animated.View>
                )}

                {/* Profile completion nudge */}
                {counts.profile > 0 && (
                  <Animated.View entering={FadeInDown.delay(280).duration(350)}>
                    <PressableScale
                      style={styles.profileNudge}
                      onPress={() =>
                        router.push("/(app)/(tabs)/profile" as any)
                      }
                    >
                      <View style={styles.profileNudgeIcon}>
                        <Ionicons
                          name="person-add"
                          size={18}
                          color={Colors.warning}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nudgeTitle}>
                          Complete your profile
                        </Text>
                        <Text style={styles.nudgeSubtitle}>
                          Add your photo and phone to build trust
                        </Text>
                      </View>
                      <View style={styles.profileNudgeBadge}>
                        <Text style={styles.profileNudgeBadgeText}>1</Text>
                      </View>
                    </PressableScale>
                  </Animated.View>
                )}

                {/* Unrated sessions nudge */}
                {counts.sessions > 0 && (
                  <Animated.View entering={FadeInDown.delay(290).duration(350)}>
                    <PressableScale
                      style={styles.nudgeCard}
                      onPress={() =>
                        router.push("/(app)/(tabs)/bookings" as any)
                      }
                    >
                      <View style={styles.nudgeIconCircle}>
                        <Ionicons
                          name="star-half"
                          size={18}
                          color={Colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nudgeTitle}>
                          {counts.sessions} unrated{" "}
                          {counts.sessions === 1 ? "session" : "sessions"}
                        </Text>
                        <Text style={styles.nudgeSubtitle}>
                          Leave a review to help the community
                        </Text>
                      </View>
                      <View style={styles.profileNudgeBadge}>
                        <Text style={styles.profileNudgeBadgeText}>
                          {counts.sessions}
                        </Text>
                      </View>
                    </PressableScale>
                  </Animated.View>
                )}

                {/* Nearby Chargers */}
                <Animated.View entering={FadeInDown.delay(300).duration(350)}>
                  <SectionTitle
                    title="Nearby Chargers"
                    subtitle="Sorted by distance from you"
                    actionLabel="See All"
                    onAction={() =>
                      router.push("/(app)/(tabs)/discover" as any)
                    }
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
                          distanceLabel={
                            item.distanceKm !== null
                              ? formatDistance(item.distanceKm)
                              : undefined
                          }
                          isNearest={index === 0}
                          images={item.images}
                          connectorTypes={item.connectors?.map((c) => c.type)}
                          onPress={() =>
                            router.push(`/(app)/chargers/${item.id}` as any)
                          }
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
                          onAction={() =>
                            router.push("/(app)/(tabs)/discover" as any)
                          }
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
    fontFamily: "Syne_700Bold",
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.3)",
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
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

  // Announcement
  announcementBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },
  announcementTitle: {
    ...Typography.cardTitle,
    fontSize: 13,
  },
  announcementBody: {
    ...Typography.caption,
    marginTop: 2,
  },

  // Active booking
  activeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
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
  activeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pendingApprovalLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.warning,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  liveText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.success,
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
    marginBottom: Spacing.md,
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

  // Nearest charger
  nearestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    ...Shadows.subtle,
  },
  nearestIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  nearestTitle: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontSize: 10,
  },
  nearestName: {
    ...Typography.cardTitle,
    marginTop: 1,
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

  // Nudges
  nudgeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.subtle,
  },
  nudgeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  nudgeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  nudgeSubtitle: {
    ...Typography.caption,
    marginTop: 1,
  },
  profileNudge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.warning + "33",
  },
  profileNudgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.warning + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  profileNudgeBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  profileNudgeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Nearby
  nearbyRow: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
});
