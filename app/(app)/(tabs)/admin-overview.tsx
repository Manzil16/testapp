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
  Avatar,
  EmptyStateCard,
  FilterChipRow,
  InfoPill,
  PrimaryCTA,
  SearchBar,
  SectionTitle,
  SegmentedControl,
  StatCard,
  StatCardSkeleton,
  ScreenContainer,
  Typography,
  Colors,
  Radius,
  Spacing,
  Shadows,
} from "@/src/components";
import { useEntranceAnimation, useAdminChargers, useAdminBookings } from "@/src/hooks";
import { useAuth } from "@/src/features/auth/auth-context";
import { useAdminEventLog } from "@/src/hooks/useAdminEventLog";
import { useDebounce } from "@/src/hooks/useDebounce";
import type { PlatformEvent } from "@/src/features/admin/admin.repository";
import type { ChargerStatus } from "@/src/features/chargers/charger.types";
import type { BookingStatus } from "@/src/features/bookings/booking.types";

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

const CHARGER_STATUS_CHIPS = [
  { id: "approved", label: "Approved" },
  { id: "pending", label: "Pending" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

const BOOKING_STATUS_CHIPS = [
  { id: "all", label: "All" },
  { id: "requested", label: "Requested" },
  { id: "approved", label: "Approved" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "declined", label: "Declined" },
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

  const [view, setView] = useState<"activity" | "chargers" | "bookings">("activity");
  const [searchText, setSearchText] = useState("");
  const [activeQuickFilter, setActiveQuickFilter] = useState("all");
  const [activeRoleFilter, setActiveRoleFilter] = useState("all");
  const [activeDateFilter, setActiveDateFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chargerStatusFilter, setChargerStatusFilter] = useState<ChargerStatus | "all">("approved");
  const [bookingStatusFilter, setBookingStatusFilter] = useState<BookingStatus | "all">("all");

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

  const chargersInventory = useAdminChargers(chargerStatusFilter);
  const bookingsInventory = useAdminBookings(bookingStatusFilter);

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

  // Chargers view — client-side search over the current status-filtered set.
  const chargersFiltered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return chargersInventory.chargers;
    return chargersInventory.chargers.filter((c) => {
      const host = chargersInventory.hostsById[c.hostUserId]?.displayName ?? "";
      const hay = `${c.name} ${c.address} ${c.suburb} ${c.state} ${host}`.toLowerCase();
      return hay.includes(q);
    });
  }, [chargersInventory.chargers, chargersInventory.hostsById, debouncedSearch]);

  // Bookings view — client-side search across charger, driver, host names.
  const bookingsFiltered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const list = bookingsInventory.bookings;
    if (!q) return list;
    return list.filter((b) => {
      const chargerName = bookingsInventory.chargersById[b.chargerId]?.name ?? "";
      const driverName = bookingsInventory.profilesById[b.driverUserId]?.displayName ?? "";
      const hostName = bookingsInventory.profilesById[b.hostUserId]?.displayName ?? "";
      const hay = `${chargerName} ${driverName} ${hostName} ${b.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [
    bookingsInventory.bookings,
    bookingsInventory.chargersById,
    bookingsInventory.profilesById,
    debouncedSearch,
  ]);

  const renderCharger = useCallback(
    ({ item }: { item: (typeof chargersFiltered)[number] }) => {
      const host = chargersInventory.hostsById[item.hostUserId];
      const statusColor =
        item.status === "approved"
          ? Colors.success
          : item.status === "rejected"
          ? Colors.error
          : Colors.warning;
      return (
        <View style={styles.inventoryRow}>
          <View style={[styles.eventDot, { backgroundColor: statusColor }]} />
          <View style={styles.eventContent}>
            <View style={styles.eventTopRow}>
              <Text style={styles.eventType} numberOfLines={1}>
                {item.name}
              </Text>
              <InfoPill
                label={item.status}
                variant={
                  item.status === "approved"
                    ? "success"
                    : item.status === "rejected"
                    ? "error"
                    : "warning"
                }
              />
            </View>
            <Text style={styles.eventActor} numberOfLines={1}>
              {host?.displayName ?? `Host ${item.hostUserId.slice(0, 6)}`} ·{" "}
              {item.suburb}, {item.state}
            </Text>
            <Text style={styles.inventoryMeta}>
              ${item.pricingPerKwh.toFixed(2)}/kWh · {item.maxPowerKw}kW · score {item.verificationScore}
            </Text>
          </View>
        </View>
      );
    },
    [chargersInventory.hostsById],
  );

  const renderBooking = useCallback(
    ({ item }: { item: (typeof bookingsFiltered)[number] }) => {
      const chargerInfo = bookingsInventory.chargersById[item.chargerId];
      const driver = bookingsInventory.profilesById[item.driverUserId];
      const host = bookingsInventory.profilesById[item.hostUserId];
      const amount = item.actualAmount ?? item.totalAmount ?? 0;
      const when = new Date(item.startTimeIso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const statusVariant =
        item.status === "completed"
          ? "success"
          : item.status === "active" || item.status === "approved"
          ? "primary"
          : item.status === "cancelled" || item.status === "declined" || item.status === "missed"
          ? "error"
          : "warning";
      return (
        <View style={styles.inventoryRow}>
          <Avatar uri={driver?.avatarUrl} name={driver?.displayName ?? "Driver"} size="sm" />
          <View style={styles.eventContent}>
            <View style={styles.eventTopRow}>
              <Text style={styles.eventType} numberOfLines={1}>
                {chargerInfo?.name ?? "Charger"}
              </Text>
              <InfoPill label={item.status} variant={statusVariant as any} />
            </View>
            <Text style={styles.eventActor} numberOfLines={1}>
              {driver?.displayName ?? "Driver"} → {host?.displayName ?? "Host"}
            </Text>
            <Text style={styles.inventoryMeta}>
              {when} · ${amount.toFixed(2)} ·{" "}
              {(item.actualKWh ?? item.estimatedKWh).toFixed(1)} kWh
            </Text>
          </View>
        </View>
      );
    },
    [bookingsInventory.chargersById, bookingsInventory.profilesById],
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

          {/* View switcher */}
          <SegmentedControl
            segments={[
              { id: "activity", label: "Activity" },
              { id: "chargers", label: "Chargers" },
              { id: "bookings", label: "Bookings" },
            ]}
            activeId={view}
            onChange={(id) => {
              setView(id as typeof view);
              setSearchText("");
            }}
            style={styles.viewSwitcher}
          />

          {/* Shared search bar — placeholder adjusts per view */}
          <SearchBar
            value={searchText}
            onChangeText={handleSearch}
            placeholder={
              view === "activity"
                ? "Search events — name, charger, booking ID, email..."
                : view === "chargers"
                ? "Search charger, host, suburb..."
                : "Search booking — charger, driver, host..."
            }
          />

          {view === "activity" && (
            <>
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
              <FilterChipRow
                chips={QUICK_FILTERS}
                activeId={activeQuickFilter}
                onSelect={handleQuickFilter}
              />
              <SectionTitle
                title={`${total} events`}
                subtitle={isFetching ? "Updating..." : undefined}
                topSpacing={Spacing.sm}
              />
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
            </>
          )}

          {view === "chargers" && (
            <>
              <FilterChipRow
                chips={CHARGER_STATUS_CHIPS}
                activeId={chargerStatusFilter}
                onSelect={(id) => setChargerStatusFilter(id as ChargerStatus | "all")}
              />
              <SectionTitle
                title={`${chargersFiltered.length} chargers`}
                subtitle={chargersInventory.isLoading ? "Loading..." : undefined}
                topSpacing={Spacing.sm}
              />
              <FlatList
                data={chargersFiltered}
                keyExtractor={(item) => item.id}
                renderItem={renderCharger}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  chargersInventory.isLoading ? null : (
                    <EmptyStateCard
                      icon="⚡"
                      title="No chargers found"
                      message="Try switching status or clearing the search."
                    />
                  )
                }
              />
            </>
          )}

          {view === "bookings" && (
            <>
              <FilterChipRow
                chips={BOOKING_STATUS_CHIPS}
                activeId={bookingStatusFilter}
                onSelect={(id) => setBookingStatusFilter(id as BookingStatus | "all")}
              />
              <SectionTitle
                title={`${bookingsFiltered.length} bookings`}
                subtitle={bookingsInventory.isLoading ? "Loading..." : undefined}
                topSpacing={Spacing.sm}
              />
              <FlatList
                data={bookingsFiltered}
                keyExtractor={(item) => item.id}
                renderItem={renderBooking}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  bookingsInventory.isLoading ? null : (
                    <EmptyStateCard
                      icon="📅"
                      title="No bookings found"
                      message="Try switching status or clearing the search."
                    />
                  )
                }
              />
            </>
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
  viewSwitcher: {
    marginBottom: Spacing.md,
  },
  filterSection: {
    gap: Spacing.xs,
    marginVertical: Spacing.sm,
  },
  inventoryRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    gap: Spacing.md,
    alignItems: "center",
  },
  inventoryMeta: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
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
