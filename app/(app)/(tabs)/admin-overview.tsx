import { useCallback, useEffect, useMemo, useState } from "react";
import { Redirect } from "expo-router";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import {
  EmptyStateCard,
  FilterChipRow,
  InfoPill,
  PrimaryCTA,
  SearchBar,
  SectionTitle,
  StatCard,
  StatCardSkeleton,
  ScreenContainer,
  Typography,
  Colors,
  Radius,
  Spacing,
  Shadows,
} from "@/src/components";
import { useEntranceAnimation } from "@/src/hooks";
import { useAuth } from "@/src/features/auth/auth-context";
import { useAdminEventLog } from "@/src/hooks/useAdminEventLog";
import { useDebounce } from "@/src/hooks/useDebounce";
import type { PlatformEvent } from "@/src/features/admin/admin.repository";

const EVENT_TYPE_COLORS: Record<string, string> = {
  booking: Colors.accent,
  payment: Colors.info,
  charger: Colors.warning,
  user: "#8B5CF6",
  session: Colors.accent,
  review: Colors.success,
  image: "#6B7280",
  admin: "#F59E0B",
};

const QUICK_FILTERS = [
  { id: "all", label: "All" },
  { id: "needs_action", label: "Needs action" },
  { id: "payments", label: "Payments captured" },
  { id: "cancellations", label: "Cancellations" },
  { id: "new_chargers", label: "New chargers" },
  { id: "completed", label: "Completed sessions" },
];

const ACTOR_ROLES = [
  { id: "all", label: "All roles" },
  { id: "driver", label: "Driver" },
  { id: "host", label: "Host" },
  { id: "admin", label: "Admin" },
  { id: "system", label: "System" },
];

const DATE_RANGES = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
];

function getDateFrom(rangeId: string): string | undefined {
  const now = new Date();
  if (rangeId === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (rangeId === "7d") {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (rangeId === "30d") {
    now.setDate(now.getDate() - 30);
    return now.toISOString();
  }
  return undefined;
}

function getEventTypesForQuickFilter(id: string): string[] | undefined {
  switch (id) {
    case "needs_action":
      return ["charger.submitted"];
    case "payments":
      return ["payment.captured"];
    case "cancellations":
      return ["booking.cancelled"];
    case "new_chargers":
      return ["charger.submitted"];
    case "completed":
      return ["booking.completed", "session.ended"];
    default:
      return undefined;
  }
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getEventColor(eventType: string): string {
  const category = eventType.split(".")[0];
  return EVENT_TYPE_COLORS[category] ?? Colors.textMuted;
}

export default function AdminOverviewScreen() {
  const { profile } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const {
    events,
    total,
    stats,
    isLoading,
    isFetching,
    filter,
    setFilter,
    loadMore,
    refetch,
  } = useAdminEventLog();

  const [searchText, setSearchText] = useState("");
  const [activeQuickFilter, setActiveQuickFilter] = useState("all");
  const [activeRoleFilter, setActiveRoleFilter] = useState("all");
  const [activeDateFilter, setActiveDateFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchText, 400);

  // Apply search with debounce
  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
    },
    []
  );

  // Update filter when debounced search changes
  useEffect(() => {
    setFilter({ search: debouncedSearch || undefined });
  }, [debouncedSearch, setFilter]);

  const handleQuickFilter = useCallback(
    (id: string) => {
      setActiveQuickFilter(id);
      setFilter({ eventTypes: getEventTypesForQuickFilter(id) });
    },
    [setFilter]
  );

  const handleRoleFilter = useCallback(
    (id: string) => {
      setActiveRoleFilter(id);
      setFilter({ actorRole: id === "all" ? undefined : id });
    },
    [setFilter]
  );

  const handleDateFilter = useCallback(
    (id: string) => {
      setActiveDateFilter(id);
      setFilter({ dateFrom: getDateFrom(id) });
    },
    [setFilter]
  );

  const renderEvent = useCallback(
    ({ item }: { item: PlatformEvent }) => {
      const isExpanded = expandedId === item.id;
      const color = getEventColor(item.eventType);

      return (
        <Pressable onPress={() => setExpandedId(isExpanded ? null : item.id)}>
          <View style={styles.eventRow}>
            <View style={[styles.eventDot, { backgroundColor: color }]} />
            <View style={styles.eventContent}>
              <View style={styles.eventTopRow}>
                <Text style={styles.eventType} numberOfLines={1}>
                  {item.eventType.replace(".", " ")}
                </Text>
                <Text style={styles.eventTime}>{formatTimeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.eventActor} numberOfLines={1}>
                {item.actor?.displayName ?? item.actorRole ?? "System"}
                {item.metadata?.charger_name ? ` · ${item.metadata.charger_name}` : ""}
              </Text>
              {item.amountCents != null && (
                <Text
                  style={[
                    styles.eventAmount,
                    { color: item.amountCents >= 0 ? Colors.success : Colors.error },
                  ]}
                >
                  ${(Math.abs(item.amountCents) / 100).toFixed(2)}
                </Text>
              )}

              {/* Expanded metadata */}
              {isExpanded && item.metadata && (
                <View style={styles.metadataBox}>
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <View key={key} style={styles.metadataRow}>
                      <Text style={styles.metadataKey}>{key}</Text>
                      <Text style={styles.metadataValue} numberOfLines={2}>
                        {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [expandedId]
  );

  if (!profile?.isAdmin) return <Redirect href="/(app)/(tabs)/discover" />;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <Text style={Typography.pageTitle}>Platform Overview</Text>

          {/* Stats Row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statsScroll}
            contentContainerStyle={styles.statsContent}
          >
            {stats ? (
              <>
                <StatCard
                  icon="cash"
                  label="Revenue today"
                  value={`$${stats.revenueToday.toFixed(2)}`}
                  style={styles.statCard}
                />
                <StatCard
                  icon="flash"
                  label="Active sessions"
                  value={String(stats.activeSessions)}
                  style={styles.statCard}
                />
                <StatCard
                  icon="time"
                  label="Pending approvals"
                  value={String(stats.pendingApprovals)}
                  style={styles.statCard}
                />
                <StatCard
                  icon="person-add"
                  label="New users (7d)"
                  value={String(stats.newUsersThisWeek)}
                  style={styles.statCard}
                />
              </>
            ) : (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            )}
          </ScrollView>

          {/* Search */}
          <SearchBar
            value={searchText}
            onChangeText={handleSearch}
            placeholder="Search by name, charger, booking ID, email..."
          />

          {/* Filter Rows */}
          <View style={styles.filterSection}>
            <FilterChipRow
              chips={DATE_RANGES}
              activeId={activeDateFilter}
              onSelect={handleDateFilter}
            />
            <FilterChipRow
              chips={ACTOR_ROLES}
              activeId={activeRoleFilter}
              onSelect={handleRoleFilter}
            />
          </View>

          {/* Quick filter chips */}
          <FilterChipRow
            chips={QUICK_FILTERS}
            activeId={activeQuickFilter}
            onSelect={handleQuickFilter}
          />

          {/* Event count */}
          <SectionTitle
            title={`${total} events`}
            subtitle={isFetching ? "Updating..." : undefined}
            topSpacing={Spacing.sm}
          />

          {/* Event List */}
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={renderEvent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              isLoading ? null : (
                <EmptyStateCard
                  icon="📊"
                  title="No events found"
                  message="Try adjusting your search or filters."
                  actionLabel="Reset filters"
                  onAction={() => {
                    setSearchText("");
                    setActiveQuickFilter("all");
                    setActiveRoleFilter("all");
                    setActiveDateFilter("all");
                    setFilter({
                      search: undefined,
                      eventTypes: undefined,
                      actorRole: undefined,
                      dateFrom: undefined,
                    });
                  }}
                />
              )
            }
            ListFooterComponent={
              events.length < total ? (
                <PrimaryCTA
                  label="Load more"
                  onPress={loadMore}
                  style={styles.loadMoreBtn}
                />
              ) : null
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
  statsScroll: {
    marginVertical: Spacing.md,
  },
  statsContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  statCard: {
    width: 150,
  },
  filterSection: {
    gap: Spacing.xs,
    marginVertical: Spacing.sm,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  eventRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    gap: Spacing.md,
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  eventContent: {
    flex: 1,
  },
  eventTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventType: {
    ...Typography.cardTitle,
    flex: 1,
    textTransform: "capitalize",
  },
  eventTime: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  eventActor: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  eventAmount: {
    ...Typography.cardTitle,
    marginTop: Spacing.xs,
  },
  metadataBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  metadataRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metadataKey: {
    ...Typography.caption,
    color: Colors.textMuted,
    width: 120,
  },
  metadataValue: {
    ...Typography.caption,
    color: Colors.textPrimary,
    flex: 1,
  },
  loadMoreBtn: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xxl,
  },
});
