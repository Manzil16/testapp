import { useMemo } from "react";
import { useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChargerStatusBadge,
  EmptyStateCard,
  PremiumCard,
  PressableScale,
  ScreenContainer,
  Colors,
  Spacing,
  Radius,
  Shadows,
  Typography,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { useHostDashboard, useRefresh } from "@/src/hooks";
import type { Booking } from "@/src/features/bookings/booking.types";

function fmt(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function fmtKwh(kwh: number) {
  return kwh >= 1000 ? `${(kwh / 1000).toFixed(1)} MWh` : `${kwh.toFixed(1)} kWh`;
}

function BarChart({ data, max }: { data: { label: string; value: number }[]; max: number }) {
  return (
    <View style={barStyles.wrap}>
      {data.map((d) => {
        const pct = max > 0 ? Math.max(0.02, d.value / max) : 0.02;
        return (
          <View key={d.label} style={barStyles.col}>
            <Text style={barStyles.barValue}>{d.value > 0 ? fmt(d.value).replace("$", "") : ""}</Text>
            <View style={barStyles.barTrack}>
              <View style={[barStyles.barFill, { height: `${pct * 100}%` as any }]} />
            </View>
            <Text style={barStyles.barLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    height: 100,
    paddingTop: Spacing.md,
  },
  col: {
    flex: 1,
    alignItems: "center",
  },
  barValue: {
    ...Typography.caption,
    fontSize: 9,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  barTrack: {
    width: "70%",
    height: 72,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
  },
  barLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
});

export default function HostAnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = useMemo(() => user?.id, [user?.id]);

  const { data, isLoading, refresh } = useHostDashboard(userId);
  const { refreshing, onRefresh } = useRefresh(refresh);

  const allBookings: Booking[] = useMemo(() => data.bookings ?? [], [data.bookings]);

  // Lifetime stats
  const lifetimeStats = useMemo(() => {
    const completed = allBookings.filter((b) => b.status === "completed");
    const revenue = completed.reduce(
      (s, b) => s + ((b.actualAmount ?? b.totalAmount) - b.platformFee),
      0
    );
    const kwh = completed.reduce(
      (s, b) => s + (b.actualKWh ?? b.estimatedKWh ?? 0),
      0
    );
    const avgSession = completed.length > 0 ? revenue / completed.length : 0;
    return { sessions: completed.length, revenue, kwh, avgSession };
  }, [allBookings]);

  // Last 4 weeks breakdown
  const weeklyData = useMemo(() => {
    const weeks: { label: string; value: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - i * 7 - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const rev = allBookings
        .filter((b) => {
          const d = new Date(b.createdAtIso);
          return b.status === "completed" && d >= weekStart && d < weekEnd;
        })
        .reduce(
          (s, b) => s + ((b.actualAmount ?? b.totalAmount) - b.platformFee),
          0
        );

      const label = i === 0 ? "This wk" : i === 1 ? "Last wk" : `${i}w ago`;
      weeks.push({ label, value: rev });
    }
    return weeks;
  }, [allBookings]);

  const weeklyMax = useMemo(
    () => Math.max(...weeklyData.map((w) => w.value), 1),
    [weeklyData]
  );

  // Per-charger performance
  const chargerStats = useMemo(() => {
    return data.chargers.map((c) => {
      const cb = allBookings.filter((b) => b.chargerId === c.id && b.status === "completed");
      const rev = cb.reduce(
        (s, b) => s + ((b.actualAmount ?? b.totalAmount) - b.platformFee),
        0
      );
      const kwh = cb.reduce((s, b) => s + (b.actualKWh ?? b.estimatedKWh ?? 0), 0);
      const pending = allBookings.filter(
        (b) => b.chargerId === c.id && b.status === "requested"
      ).length;
      return { charger: c, sessions: cb.length, revenue: rev, kwh, pending };
    });
  }, [data.chargers, allBookings]);

  // Booking state breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of allBookings) {
      counts[b.status] = (counts[b.status] ?? 0) + 1;
    }
    return counts;
  }, [allBookings]);

  const STATUS_COLORS: Record<string, string> = {
    completed: Colors.success,
    approved: Colors.primary,
    requested: Colors.warning,
    cancelled: Colors.error,
    declined: Colors.error,
    missed: Colors.error,
    expired: Colors.textMuted,
    active: Colors.info,
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={[Typography.pageTitle, { flex: 1 }]}>Analytics</Text>
        <Text style={styles.headerSub}>Lifetime</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Lifetime hero */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <LinearGradient
            colors={Colors.gradientHero as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabel}>Total earnings</Text>
            <Text style={styles.heroValue}>{fmt(lifetimeStats.revenue)}</Text>
            <View style={styles.heroRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{lifetimeStats.sessions}</Text>
                <Text style={styles.heroStatLabel}>Sessions</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{fmtKwh(lifetimeStats.kwh)}</Text>
                <Text style={styles.heroStatLabel}>Delivered</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{fmt(lifetimeStats.avgSession)}</Text>
                <Text style={styles.heroStatLabel}>Avg/session</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Weekly revenue chart */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)}>
          <PremiumCard style={styles.section}>
            <Text style={styles.sectionTitle}>Weekly Revenue</Text>
            <Text style={styles.sectionSub}>Last 4 weeks · net of platform fee</Text>
            <BarChart data={weeklyData} max={weeklyMax} />
          </PremiumCard>
        </Animated.View>

        {/* Booking status breakdown */}
        <Animated.View entering={FadeInDown.delay(160).duration(300)}>
          <PremiumCard style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Breakdown</Text>
            <Text style={styles.sectionSub}>All time · {allBookings.length} total</Text>
            <View style={styles.statusGrid}>
              {Object.entries(statusBreakdown).map(([status, count]) => (
                <View key={status} style={styles.statusItem}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLORS[status] ?? Colors.textMuted },
                    ]}
                  />
                  <Text style={styles.statusLabel}>{status}</Text>
                  <Text style={styles.statusCount}>{count}</Text>
                </View>
              ))}
            </View>
          </PremiumCard>
        </Animated.View>

        {/* Per-charger performance */}
        <Animated.View entering={FadeInDown.delay(240).duration(300)}>
          <Text style={styles.listSectionTitle}>Charger Performance</Text>
          {chargerStats.length === 0 ? (
            <EmptyStateCard
              icon="⚡"
              title="No chargers yet"
              message="Add your first charger to start earning."
              actionLabel="Add charger"
              onAction={() => router.push("/(app)/host/charger-form" as any)}
            />
          ) : (
            chargerStats.map((cs, i) => (
              <Animated.View
                key={cs.charger.id}
                entering={FadeInDown.delay(260 + i * 40).duration(300)}
              >
                <PressableScale
                  style={styles.chargerCard}
                  onPress={() =>
                    router.push(`/(app)/chargers/${cs.charger.id}` as any)
                  }
                >
                  <View style={styles.chargerCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chargerName} numberOfLines={1}>
                        {cs.charger.name}
                      </Text>
                      <Text style={styles.chargerAddr} numberOfLines={1}>
                        {cs.charger.address}
                      </Text>
                    </View>
                    <ChargerStatusBadge status={cs.charger.status} />
                  </View>

                  <View style={styles.chargerStats}>
                    <View style={styles.chargerStat}>
                      <Text style={styles.chargerStatValue}>{fmt(cs.revenue)}</Text>
                      <Text style={styles.chargerStatLabel}>Earned</Text>
                    </View>
                    <View style={styles.chargerStatDivider} />
                    <View style={styles.chargerStat}>
                      <Text style={styles.chargerStatValue}>{cs.sessions}</Text>
                      <Text style={styles.chargerStatLabel}>Sessions</Text>
                    </View>
                    <View style={styles.chargerStatDivider} />
                    <View style={styles.chargerStat}>
                      <Text style={styles.chargerStatValue}>{fmtKwh(cs.kwh)}</Text>
                      <Text style={styles.chargerStatLabel}>Delivered</Text>
                    </View>
                    <View style={styles.chargerStatDivider} />
                    <View style={styles.chargerStat}>
                      <Text
                        style={[
                          styles.chargerStatValue,
                          cs.pending > 0 && { color: Colors.warning },
                        ]}
                      >
                        {cs.pending}
                      </Text>
                      <Text style={styles.chargerStatLabel}>Pending</Text>
                    </View>
                  </View>
                </PressableScale>
              </Animated.View>
            ))
          )}
        </Animated.View>

        {/* Payout info */}
        <Animated.View entering={FadeInDown.delay(400).duration(300)}>
          <PremiumCard style={[styles.section, styles.payoutNote]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
            <Text style={styles.payoutText}>
              You receive <Text style={styles.payoutBold}>90%</Text> of each session
              subtotal. The remaining 10% is the VehicleGrid platform fee. Payouts are
              processed within 2 business days of session completion.
            </Text>
          </PremiumCard>
        </Animated.View>

        <View style={{ height: Spacing.xxxl + 20 }} />
      </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSub: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },

  // Hero
  heroCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.glow,
  },
  heroLabel: {
    ...Typography.label,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  heroValue: {
    ...Typography.heroNumber,
    fontSize: 36,
    color: Colors.textInverse,
    marginBottom: Spacing.lg,
  },
  heroRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: "center",
  },
  heroStatValue: {
    ...Typography.sectionTitle,
    fontSize: 16,
    color: Colors.textInverse,
  },
  heroStatLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: "rgba(255,255,255,0.65)",
    textTransform: "uppercase",
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  // Cards
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
    marginBottom: 2,
  },
  sectionSub: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },

  // Status breakdown
  statusGrid: {
    gap: Spacing.sm,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    ...Typography.label,
    flex: 1,
    color: Colors.textPrimary,
    textTransform: "capitalize",
  },
  statusCount: {
    ...Typography.label,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },

  // Per-charger list
  listSectionTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  chargerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  chargerCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  chargerName: {
    ...Typography.cardTitle,
    fontWeight: "700" as const,
    marginBottom: 2,
  },
  chargerAddr: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  chargerStats: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  chargerStat: {
    flex: 1,
    alignItems: "center",
  },
  chargerStatValue: {
    ...Typography.label,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
  },
  chargerStatLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: "uppercase",
  },
  chargerStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },

  // Payout info
  payoutNote: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  payoutText: {
    ...Typography.label,
    flex: 1,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  payoutBold: {
    ...Typography.label,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
  },
});
