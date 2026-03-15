import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  AnimatedListItem,
  Avatar,
  BottomSheet,
  EmptyStateCard,
  InfoPill,
  PrimaryCTA,
  PressableScale,
  ScreenContainer,
  SearchBar,
  SectionTitle,
  SecondaryButton,
  SegmentedControl,
  StatCard,
  StatCardSkeleton,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { useEntranceAnimation } from "@/src/hooks";
import {
  listenToChargers,
  updateChargerStatus,
  type Charger,
} from "@/src/features/chargers";
import {
  listenToVerificationQueue,
  type VerificationRequest,
} from "@/src/features/verification";
import { updateUserProfile, type AppRole } from "@/src/features/users";
import { updateBookingStatus } from "@/src/features/bookings";
import { db } from "@/src/firebaseConfig";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useRefresh } from "@/src/hooks";

interface BookingLite {
  id: string;
  chargerId: string;
  driverUserId: string;
  hostUserId: string;
  status: string;
  estimatedKWh: number;
  startTimeIso?: string;
  endTimeIso?: string;
  updatedAt?: string;
}

interface UserLite {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

type AdminPanel = "users" | "chargers" | "bookings" | "revenue";
type RevenueWindow = "week" | "month" | "all";
type BookingFilter = "all" | "pending" | "confirmed" | "done" | "declined";

const BOOKING_FILTER_SEGMENTS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "done", label: "Done" },
  { id: "declined", label: "Declined" },
];

const REVENUE_SEGMENTS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All Time" },
];

function statusMatchesFilter(status: string, filter: BookingFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return status === "requested";
  if (filter === "confirmed") return status === "approved" || status === "in_progress";
  if (filter === "done") return status === "completed";
  if (filter === "declined") return status === "declined" || status === "cancelled";
  return false;
}

function isWithinWindow(isoDate: string | undefined, window: RevenueWindow): boolean {
  if (window === "all" || !isoDate) return true;
  const d = new Date(isoDate);
  const now = Date.now();
  if (window === "week") return now - d.getTime() < 7 * 86400000;
  return now - d.getTime() < 30 * 86400000;
}

export default function AdminOverviewTabScreen() {
  const { profile } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [bookings, setBookings] = useState<BookingLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<VerificationRequest[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<AdminPanel | null>(null);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Management sheets
  const [selectedUser, setSelectedUser] = useState<UserLite | null>(null);
  const [selectedCharger, setSelectedCharger] = useState<Charger | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingLite | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [revenueWindow, setRevenueWindow] = useState<RevenueWindow>("all");

  useEffect(() => {
    let chargersReady = false;
    let bookingsReady = false;
    let usersReady = false;
    let queueReady = false;

    const markReady = () => {
      if (chargersReady && bookingsReady && usersReady && queueReady) {
        setIsLoading(false);
      }
    };

    const unsubChargers = listenToChargers(
      (items) => {
        setChargers(items);
        chargersReady = true;
        markReady();
      },
      undefined,
      (message) => {
        setError(message);
        chargersReady = true;
        markReady();
      }
    );

    const bookingsQuery = query(
      collection(db, "bookings"),
      orderBy("updatedAt", "desc"),
      limit(250)
    );

    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        setBookings(
          snapshot.docs.map((item) => {
            const data = item.data() as {
              chargerId?: string;
              driverUserId?: string;
              hostUserId?: string;
              status?: string;
              estimatedKWh?: number;
              startTime?: { toDate?: () => Date };
              endTime?: { toDate?: () => Date };
              updatedAt?: { toDate?: () => Date };
            };

            return {
              id: item.id,
              chargerId: data.chargerId || "",
              driverUserId: data.driverUserId || "",
              hostUserId: data.hostUserId || "",
              status: data.status || "unknown",
              estimatedKWh: data.estimatedKWh || 0,
              startTimeIso: data.startTime?.toDate?.()?.toISOString?.(),
              endTimeIso: data.endTime?.toDate?.()?.toISOString?.(),
              updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || undefined,
            };
          })
        );
        bookingsReady = true;
        markReady();
      },
      (err) => {
        setError(err.message);
        bookingsReady = true;
        markReady();
      }
    );

    const usersQuery = query(collection(db, "users"), limit(300));
    const unsubUsers = onSnapshot(
      usersQuery,
      (snapshot) => {
        setUsers(
          snapshot.docs.map((item) => {
            const data = item.data() as { displayName?: string; email?: string; role?: string };
            return {
              id: item.id,
              displayName: data.displayName || "Unnamed user",
              email: data.email || "No email",
              role: data.role || "unknown",
            };
          })
        );
        usersReady = true;
        markReady();
      },
      (err) => {
        setError(err.message);
        usersReady = true;
        markReady();
      }
    );

    const unsubQueue = listenToVerificationQueue((items) => {
      setVerificationQueue(items);
      queueReady = true;
      markReady();
    });

    return () => {
      unsubChargers();
      unsubBookings();
      unsubUsers();
      unsubQueue();
    };
  }, []);

  const refresh = async () => {
    return;
  };
  const { refreshing, onRefresh } = useRefresh(refresh);

  const chargerById = useMemo(
    () => Object.fromEntries(chargers.map((item) => [item.id, item])),
    [chargers]
  );

  const userById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u])),
    [users]
  );

  // ── Revenue calculations ──
  const filteredCompletedBookings = useMemo(
    () =>
      bookings.filter(
        (b) => b.status === "completed" && isWithinWindow(b.updatedAt, revenueWindow)
      ),
    [bookings, revenueWindow]
  );

  const estimatedRevenue = useMemo(() => {
    return filteredCompletedBookings.reduce((sum, booking) => {
      const charger = chargerById[booking.chargerId];
      if (!charger) return sum;
      return sum + booking.estimatedKWh * charger.pricingPerKwh;
    }, 0);
  }, [filteredCompletedBookings, chargerById]);

  const revenueByCharger = useMemo(() => {
    const grouped: Record<
      string,
      { id: string; chargerName: string; hostUserId: string; bookingCount: number; kWh: number; revenue: number }
    > = {};

    filteredCompletedBookings.forEach((booking) => {
      const charger = chargerById[booking.chargerId];
      if (!charger) return;

      if (!grouped[booking.chargerId]) {
        grouped[booking.chargerId] = {
          id: booking.chargerId,
          chargerName: charger.name,
          hostUserId: charger.hostUserId,
          bookingCount: 0,
          kWh: 0,
          revenue: 0,
        };
      }

      grouped[booking.chargerId].bookingCount += 1;
      grouped[booking.chargerId].kWh += booking.estimatedKWh;
      grouped[booking.chargerId].revenue += booking.estimatedKWh * charger.pricingPerKwh;
    });

    return Object.values(grouped).sort((a, b) => b.revenue - a.revenue);
  }, [filteredCompletedBookings, chargerById]);

  const revenueByHost = useMemo(() => {
    const grouped: Record<string, { hostId: string; hostName: string; revenue: number; bookingCount: number }> = {};

    revenueByCharger.forEach((row) => {
      const host = userById[row.hostUserId];
      const hostName = host?.displayName || row.hostUserId.slice(0, 8);

      if (!grouped[row.hostUserId]) {
        grouped[row.hostUserId] = { hostId: row.hostUserId, hostName, revenue: 0, bookingCount: 0 };
      }
      grouped[row.hostUserId].revenue += row.revenue;
      grouped[row.hostUserId].bookingCount += row.bookingCount;
    });

    return Object.values(grouped).sort((a, b) => b.revenue - a.revenue);
  }, [revenueByCharger, userById]);

  const normalizedSearch = searchText.trim().toLowerCase();

  // ── Filtered bookings for booking panel ──
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => statusMatchesFilter(b.status, bookingFilter))
      .filter((b) => {
        if (!normalizedSearch) return true;
        const chargerName = chargerById[b.chargerId]?.name || "";
        const driverName = userById[b.driverUserId]?.displayName || "";
        const hostName = userById[b.hostUserId]?.displayName || "";
        const haystack = `${b.id} ${b.status} ${chargerName} ${driverName} ${hostName}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [bookings, bookingFilter, normalizedSearch, chargerById, userById]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (!normalizedSearch) return true;
      const haystack = `${user.id} ${user.displayName} ${user.email} ${user.role}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [users, normalizedSearch]);

  const filteredChargers = useMemo(() => {
    return chargers.filter((charger) => {
      if (!normalizedSearch) return true;
      const hostName = userById[charger.hostUserId]?.displayName || "";
      const haystack =
        `${charger.id} ${charger.name} ${charger.suburb} ${charger.state} ${charger.status} ${hostName}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [chargers, normalizedSearch, userById]);

  // ── Admin Actions ──
  const handleChangeRole = useCallback(
    async (userId: string, newRole: AppRole) => {
      setActionLoading(true);
      try {
        await updateUserProfile(userId, { role: newRole });
        setSelectedUser(null);
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to update role.");
      } finally {
        setActionLoading(false);
      }
    },
    []
  );

  const handleDeleteUser = useCallback(async (userId: string) => {
    Alert.alert("Delete User", "This will permanently remove the user profile. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            await deleteDoc(doc(db, "users", userId));
            setSelectedUser(null);
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete user.");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, []);

  const handleChargerAction = useCallback(
    async (chargerId: string, action: "approve" | "reject" | "suspend" | "remove") => {
      setActionLoading(true);
      try {
        if (action === "remove") {
          await deleteDoc(doc(db, "chargers", chargerId));
        } else if (action === "approve") {
          await updateChargerStatus(chargerId, "verified", 100);
        } else if (action === "suspend") {
          await updateChargerStatus(chargerId, "suspended", 10);
        } else {
          await updateChargerStatus(chargerId, "rejected", 0);
        }
        setSelectedCharger(null);
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to update charger.");
      } finally {
        setActionLoading(false);
      }
    },
    []
  );

  const handleBookingAction = useCallback(
    async (bookingId: string, newStatus: "approved" | "declined" | "cancelled") => {
      setActionLoading(true);
      try {
        await updateBookingStatus(bookingId, newStatus);
        setSelectedBooking(null);
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to update booking.");
      } finally {
        setActionLoading(false);
      }
    },
    []
  );

  const statusPillVariant = (status: string) => {
    if (status === "verified" || status === "completed" || status === "approved") return "success" as const;
    if (status === "pending_verification" || status === "requested") return "warning" as const;
    if (status === "rejected" || status === "declined" || status === "cancelled" || status === "suspended")
      return "error" as const;
    return "default" as const;
  };

  // ── Render helpers ──
  const renderUserRow = ({ item, index }: { item: UserLite; index: number }) => (
    <AnimatedListItem index={index}>
      <Pressable
        style={styles.adminCard}
        onPress={() => setSelectedUser(item)}
      >
        <View style={styles.cardTopRow}>
          <Avatar name={item.displayName} size="sm" />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={styles.cardName}>{item.displayName}</Text>
            <Text style={styles.cardMeta}>{item.email}</Text>
          </View>
          <InfoPill
            label={item.role.toUpperCase()}
            variant={item.role === "admin" ? "primary" : item.role === "host" ? "info" : "default"}
          />
        </View>
        <View style={styles.cardDetailsRow}>
          <View style={styles.cardDetailItem}>
            <Ionicons name="finger-print-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.cardDetailText}>{item.id.slice(0, 10)}…</Text>
          </View>
        </View>
      </Pressable>
    </AnimatedListItem>
  );

  const renderChargerRow = ({ item, index }: { item: Charger; index: number }) => {
    const host = userById[item.hostUserId];
    return (
      <AnimatedListItem index={index}>
        <Pressable
          style={styles.adminCard}
          onPress={() => setSelectedCharger(item)}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="flash" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.suburb}, {item.state}</Text>
            </View>
            <InfoPill label={item.status.replace("_", " ")} variant={statusPillVariant(item.status)} />
          </View>
          <View style={styles.cardDetailsRow}>
            <View style={styles.cardDetailItem}>
              <Ionicons name="speedometer-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.cardDetailText}>{item.maxPowerKw}kW</Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Ionicons name="pricetag-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.cardDetailText}>${item.pricingPerKwh.toFixed(2)}/kWh</Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.cardDetailText}>{host?.displayName || item.hostUserId.slice(0, 8)}</Text>
            </View>
          </View>
        </Pressable>
      </AnimatedListItem>
    );
  };

  const renderBookingRow = ({ item, index }: { item: BookingLite; index: number }) => {
    const charger = chargerById[item.chargerId];
    const chargerName = charger?.name || item.chargerId.slice(0, 8);
    const driverName = userById[item.driverUserId]?.displayName || item.driverUserId.slice(0, 8);
    const hostName = userById[item.hostUserId]?.displayName || item.hostUserId.slice(0, 8);
    const isTerminal = item.status === "completed" || item.status === "cancelled" || item.status === "declined";
    return (
      <AnimatedListItem index={index}>
        <Pressable
          style={[styles.adminCard, isTerminal && styles.adminCardFaded]}
          onPress={() => setSelectedBooking(item)}
        >
          <View style={styles.cardTopRow}>
            <Avatar name={driverName} size="sm" />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={styles.cardName}>{chargerName}</Text>
              <Text style={styles.cardMeta}>Driver: {driverName}</Text>
            </View>
            <InfoPill label={item.status.replace("_", " ")} variant={statusPillVariant(item.status)} />
          </View>
          <View style={styles.cardDetailsRow}>
            <View style={styles.cardDetailItem}>
              <Ionicons name="battery-charging-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.cardDetailText}>{item.estimatedKWh.toFixed(1)} kWh</Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.cardDetailText}>Host: {hostName}</Text>
            </View>
          </View>
          {item.status === "requested" && (
            <View style={styles.cardActionRow}>
              <PressableScale
                onPress={() => handleBookingAction(item.id, "declined")}
                style={styles.cardDeclineBtn}
              >
                <Ionicons name="close" size={14} color={Colors.error} />
                <Text style={styles.cardDeclineText}>Decline</Text>
              </PressableScale>
              <PressableScale
                onPress={() => handleBookingAction(item.id, "approved")}
                style={styles.cardApproveBtn}
              >
                <Ionicons name="checkmark" size={14} color="#FFF" />
                <Text style={styles.cardApproveText}>Approve</Text>
              </PressableScale>
            </View>
          )}
        </Pressable>
      </AnimatedListItem>
    );
  };

  const renderRevenueRow = ({ item, index }: { item: (typeof revenueByCharger)[0]; index: number }) => (
    <AnimatedListItem index={index}>
      <View style={styles.adminCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="flash" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={styles.cardName}>{item.chargerName}</Text>
            <Text style={styles.cardMeta}>
              {item.bookingCount} bookings · {item.kWh.toFixed(1)} kWh
            </Text>
          </View>
          <Text style={styles.revenueValue}>${item.revenue.toFixed(2)}</Text>
        </View>
      </View>
    </AnimatedListItem>
  );

  const panelPlaceholder =
    selectedPanel === "users"
      ? "Search name, email, role, or id"
      : selectedPanel === "chargers"
      ? "Search charger, suburb, host, or status"
      : selectedPanel === "bookings"
      ? "Search booking, charger, driver, or host"
      : "Search charger name";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
      <ScreenContainer scrollable={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Admin Panel</Text>
            <Text style={styles.pageSubtitle}>Platform metrics and management</Text>
          </View>
          <Avatar uri={profile?.avatarUrl} name={profile?.displayName || "Admin"} size="md" />
        </View>

        {error ? (
          <EmptyStateCard icon="⚠️" title="Some metrics could not load" message={error} />
        ) : null}

        {isLoading ? (
          <View style={styles.statRow}>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </View>
        ) : (
          <View style={styles.statRow}>
            <StatCard
              icon="👤"
              value={users.length}
              label="Users"
              onPress={() => { setSelectedPanel("users"); setSearchText(""); }}
            />
            <StatCard
              icon="🔌"
              value={chargers.length}
              label="Chargers"
              onPress={() => { setSelectedPanel("chargers"); setSearchText(""); }}
            />
            <StatCard
              icon="📅"
              value={bookings.length}
              label="Bookings"
              onPress={() => { setSelectedPanel("bookings"); setSearchText(""); setBookingFilter("all"); }}
            />
            <StatCard
              icon="💰"
              value={`$${estimatedRevenue.toFixed(0)}`}
              label="Revenue"
              onPress={() => { setSelectedPanel("revenue"); setSearchText(""); }}
            />
          </View>
        )}

        {/* ── Panel Content ── */}
        {selectedPanel ? (
          <View style={styles.explorerWrap}>
            <View style={styles.panelHeader}>
              <SectionTitle
                title={
                  selectedPanel === "users"
                    ? "User Management"
                    : selectedPanel === "chargers"
                    ? "Charger Management"
                    : selectedPanel === "bookings"
                    ? "Booking Management"
                    : "Revenue Dashboard"
                }
              />
              <SecondaryButton label="Close" onPress={() => setSelectedPanel(null)} style={styles.closeBtn} />
            </View>

            {selectedPanel === "bookings" ? (
              <SegmentedControl
                segments={BOOKING_FILTER_SEGMENTS}
                activeId={bookingFilter}
                onChange={(id) => setBookingFilter(id as BookingFilter)}
              />
            ) : null}

            {selectedPanel === "revenue" ? (
              <SegmentedControl
                segments={REVENUE_SEGMENTS}
                activeId={revenueWindow}
                onChange={(id) => setRevenueWindow(id as RevenueWindow)}
              />
            ) : null}

            {selectedPanel !== "revenue" ? (
              <SearchBar value={searchText} onChangeText={setSearchText} placeholder={panelPlaceholder} />
            ) : null}

            {selectedPanel === "users" ? (
              <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.id}
                renderItem={renderUserRow}
                scrollEnabled={false}
                contentContainerStyle={styles.explorerListContent}
                ListEmptyComponent={<EmptyStateCard icon="🔎" title="No matching users" message="Adjust your search." />}
              />
            ) : null}

            {selectedPanel === "chargers" ? (
              <FlatList
                data={filteredChargers}
                keyExtractor={(item) => item.id}
                renderItem={renderChargerRow}
                scrollEnabled={false}
                contentContainerStyle={styles.explorerListContent}
                ListEmptyComponent={<EmptyStateCard icon="🔎" title="No matching chargers" message="Adjust your search." />}
              />
            ) : null}

            {selectedPanel === "bookings" ? (
              <FlatList
                data={filteredBookings}
                keyExtractor={(item) => item.id}
                renderItem={renderBookingRow}
                scrollEnabled={false}
                contentContainerStyle={styles.explorerListContent}
                ListEmptyComponent={<EmptyStateCard icon="🔎" title="No matching bookings" message="Adjust your filters." />}
              />
            ) : null}

            {selectedPanel === "revenue" ? (
              <View style={styles.revenueContent}>
                <View style={styles.revenueTotalCard}>
                  <Text style={styles.revenueTotalLabel}>Total Revenue</Text>
                  <Text style={styles.revenueTotalValue}>${estimatedRevenue.toFixed(2)}</Text>
                  <Text style={styles.revenueTotalSub}>
                    {filteredCompletedBookings.length} completed bookings
                  </Text>
                </View>

                <SectionTitle title="Top Chargers" subtitle="By revenue earned" />
                <FlatList
                  data={revenueByCharger.slice(0, 10)}
                  keyExtractor={(item) => item.id}
                  renderItem={renderRevenueRow}
                  scrollEnabled={false}
                  contentContainerStyle={styles.explorerListContent}
                  ListEmptyComponent={<EmptyStateCard icon="📊" title="No revenue data" message="Completed bookings will appear here." />}
                />

                <SectionTitle title="Top Hosts" subtitle="By revenue earned" />
                {revenueByHost.slice(0, 10).map((host, index) => (
                  <AnimatedListItem key={host.hostId} index={index}>
                    <View style={styles.adminCard}>
                      <View style={styles.cardTopRow}>
                        <Avatar name={host.hostName} size="sm" />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <Text style={styles.cardName}>{host.hostName}</Text>
                          <Text style={styles.cardMeta}>{host.bookingCount} bookings</Text>
                        </View>
                        <Text style={styles.revenueValue}>${host.revenue.toFixed(2)}</Text>
                      </View>
                    </View>
                  </AnimatedListItem>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyStateCard
            icon="🧭"
            title="Open a data view"
            message="Tap Users, Chargers, Bookings, or Revenue to manage platform data."
          />
        )}
      </ScreenContainer>
      </Animated.View>

      {/* ── User Management Sheet ── */}
      <BottomSheet
        visible={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.displayName || "User"}
        subtitle={selectedUser?.email}
      >
        {selectedUser ? (
          <View style={styles.sheetContent}>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Current Role</Text>
              <InfoPill label={selectedUser.role.toUpperCase()} variant="primary" />
            </View>
            <Text style={styles.sheetLabel}>Change Role</Text>
            <View style={styles.roleRow}>
              {(["driver", "host", "admin"] as AppRole[]).map((role) => (
                <SecondaryButton
                  key={role}
                  label={role.charAt(0).toUpperCase() + role.slice(1)}
                  onPress={() => handleChangeRole(selectedUser.id, role)}
                  disabled={selectedUser.role === role || actionLoading}
                  style={styles.roleBtn}
                />
              ))}
            </View>
            <View style={styles.sheetDivider} />
            <PrimaryCTA
              label="Delete User"
              variant="danger"
              onPress={() => handleDeleteUser(selectedUser.id)}
              disabled={actionLoading}
            />
          </View>
        ) : null}
      </BottomSheet>

      {/* ── Charger Management Sheet ── */}
      <BottomSheet
        visible={!!selectedCharger}
        onClose={() => setSelectedCharger(null)}
        title={selectedCharger?.name || "Charger"}
        subtitle={selectedCharger ? `${selectedCharger.suburb}, ${selectedCharger.state}` : undefined}
      >
        {selectedCharger ? (
          <View style={styles.sheetContent}>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Status</Text>
              <InfoPill
                label={selectedCharger.status.replace("_", " ")}
                variant={statusPillVariant(selectedCharger.status)}
              />
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Host</Text>
              <Text style={styles.sheetValue}>
                {userById[selectedCharger.hostUserId]?.displayName || selectedCharger.hostUserId.slice(0, 12)}
              </Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Power</Text>
              <Text style={styles.sheetValue}>{selectedCharger.maxPowerKw}kW</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Price</Text>
              <Text style={styles.sheetValue}>${selectedCharger.pricingPerKwh.toFixed(2)}/kWh</Text>
            </View>
            <View style={styles.sheetDivider} />
            <View style={styles.actionRow}>
              <SecondaryButton
                label="Approve"
                onPress={() => handleChargerAction(selectedCharger.id, "approve")}
                disabled={selectedCharger.status === "verified" || actionLoading}
                style={styles.actionBtn}
              />
              <SecondaryButton
                label="Reject"
                onPress={() => handleChargerAction(selectedCharger.id, "reject")}
                disabled={actionLoading}
                style={styles.actionBtn}
              />
            </View>
            <SecondaryButton
              label="Suspend Charger"
              onPress={() =>
                Alert.alert("Suspend Charger", "This charger will be hidden from drivers until reinstated.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Suspend",
                    style: "destructive",
                    onPress: () => handleChargerAction(selectedCharger.id, "suspend"),
                  },
                ])
              }
              disabled={selectedCharger.status === "suspended" || actionLoading}
              style={{ marginTop: Spacing.xs }}
            />
            <PrimaryCTA
              label="Remove Charger"
              variant="danger"
              onPress={() =>
                Alert.alert("Remove Charger", "This will permanently delete this charger listing.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => handleChargerAction(selectedCharger.id, "remove"),
                  },
                ])
              }
              disabled={actionLoading}
            />
          </View>
        ) : null}
      </BottomSheet>

      {/* ── Booking Detail Sheet ── */}
      <BottomSheet
        visible={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title={`Booking ${selectedBooking?.id.slice(0, 8) || ""}`}
        subtitle={selectedBooking ? `Status: ${selectedBooking.status}` : undefined}
      >
        {selectedBooking ? (
          <View style={styles.sheetContent}>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Charger</Text>
              <Text style={styles.sheetValue}>
                {chargerById[selectedBooking.chargerId]?.name || selectedBooking.chargerId.slice(0, 12)}
              </Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Driver</Text>
              <Text style={styles.sheetValue}>
                {userById[selectedBooking.driverUserId]?.displayName || selectedBooking.driverUserId.slice(0, 12)}
              </Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Host</Text>
              <Text style={styles.sheetValue}>
                {userById[selectedBooking.hostUserId]?.displayName || selectedBooking.hostUserId.slice(0, 12)}
              </Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Energy</Text>
              <Text style={styles.sheetValue}>{selectedBooking.estimatedKWh.toFixed(1)} kWh</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Status</Text>
              <InfoPill label={selectedBooking.status} variant={statusPillVariant(selectedBooking.status)} />
            </View>
            <View style={styles.sheetDivider} />
            <View style={styles.actionRow}>
              <SecondaryButton
                label="Approve"
                onPress={() => handleBookingAction(selectedBooking.id, "approved")}
                disabled={selectedBooking.status !== "requested" || actionLoading}
                style={styles.actionBtn}
              />
              <SecondaryButton
                label="Decline"
                onPress={() => handleBookingAction(selectedBooking.id, "declined")}
                disabled={
                  selectedBooking.status === "completed" ||
                  selectedBooking.status === "cancelled" ||
                  selectedBooking.status === "declined" ||
                  actionLoading
                }
                style={styles.actionBtn}
              />
            </View>
            <SecondaryButton
              label="Cancel Booking"
              onPress={() => handleBookingAction(selectedBooking.id, "cancelled")}
              disabled={
                selectedBooking.status === "completed" ||
                selectedBooking.status === "cancelled" ||
                actionLoading
              }
            />
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  explorerWrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    ...Shadows.card,
    flex: 1,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeBtn: {
    paddingHorizontal: Spacing.md,
  },
  explorerListContent: {
    marginTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  // Card-based list items (matching host-bookings style)
  adminCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  adminCardFaded: {
    opacity: 0.65,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: "400",
    color: Colors.textMuted,
    marginTop: 1,
  },
  cardDetailsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cardDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardDetailText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  cardActionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  cardDeclineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorLight,
  },
  cardDeclineText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.error,
  },
  cardApproveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    ...Shadows.button,
  },
  cardApproveText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  revenueContent: {
    marginTop: Spacing.sm,
  },
  revenueTotalCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  revenueTotalLabel: {
    ...Typography.caption,
    color: Colors.primary,
  },
  revenueTotalValue: {
    ...Typography.pageTitle,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  revenueTotalSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  revenueValue: {
    ...Typography.cardTitle,
    color: Colors.primary,
  },
  sheetContent: {
    gap: Spacing.sm,
  },
  sheetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  sheetValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  sheetDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  roleRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  roleBtn: {
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
