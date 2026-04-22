import { useCallback, useMemo, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AnimatedListItem,
  Avatar,
  ChargerStatusBadge,
  EmptyStateCard,
  InfoPill,
  PressableScale,
  ScreenContainer,
  SearchBar,
  SegmentedControl,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import {
  deleteCharger,
  listChargers,
  type Charger,
} from "@/src/features/chargers";
import {
  deleteProfile,
  listAllProfiles,
  suspendUser,
} from "@/src/features/users/user.repository";
import type { UserProfile } from "@/src/features/users/user.types";
import { useAuth } from "@/src/features/auth/auth-context";
import { useEntranceAnimation, useRefresh } from "@/src/hooks";
import { useThemeColors } from "@/src/hooks/useThemeColors";

type EntityTab = "chargers" | "hosts" | "drivers";

export default function AdminDatabaseScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const entranceStyle = useEntranceAnimation();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<EntityTab>("chargers");
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // --- Chargers ---------------------------------------------------------
  const chargersQuery = useQuery({
    queryKey: ["admin", "chargers", "all"],
    queryFn: () => listChargers(),
    enabled: tab === "chargers",
  });
  const chargers = chargersQuery.data ?? [];

  // --- Users ------------------------------------------------------------
  const usersQuery = useQuery({
    queryKey: ["admin", "profiles", searchText],
    queryFn: () => listAllProfiles({ pageSize: 100, search: searchText || undefined }),
    enabled: tab === "hosts" || tab === "drivers",
  });
  const users = usersQuery.data?.items ?? [];

  const filteredChargers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return chargers;
    return chargers.filter((c) =>
      `${c.name} ${c.suburb} ${c.state} ${c.hostUserId}`.toLowerCase().includes(q),
    );
  }, [chargers, searchText]);

  const filteredHosts = useMemo(
    () => users.filter((u) => u.isHost),
    [users],
  );
  const filteredDrivers = useMemo(
    () => users.filter((u) => u.isDriver && !u.isHost),
    [users],
  );

  const refresh = useCallback(async () => {
    if (tab === "chargers") await chargersQuery.refetch();
    else await usersQuery.refetch();
  }, [tab, chargersQuery, usersQuery]);
  const { refreshing, onRefresh } = useRefresh(refresh);

  // --- Actions ----------------------------------------------------------
  const confirmDeleteCharger = (c: Charger) => {
    Alert.alert(
      "Delete charger",
      `Permanently delete "${c.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCharger(c.id);
              queryClient.invalidateQueries({ queryKey: ["admin", "chargers"] });
              queryClient.invalidateQueries({ queryKey: ["chargers"] });
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Delete failed.");
            }
          },
        },
      ],
    );
  };

  const confirmDeleteUser = (u: UserProfile) => {
    Alert.alert(
      "Delete user",
      `Permanently delete ${u.displayName || u.email}? Their chargers and bookings will be orphaned.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProfile(u.id);
              queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Delete failed.");
            }
          },
        },
      ],
    );
  };

  const toggleSuspend = async (u: UserProfile) => {
    try {
      await suspendUser(u.id, !u.isSuspended);
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  };

  if (!profile?.isAdmin) return <Redirect href="/(app)/(tabs)/discover" />;

  const activeCount =
    tab === "chargers"
      ? filteredChargers.length
      : tab === "hosts"
        ? filteredHosts.length
        : filteredDrivers.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <Text style={Typography.body}>
            Browse and manage platform entities. {activeCount} result{activeCount !== 1 ? "s" : ""}.
          </Text>

          <SearchBar
            value={searchText}
            onChangeText={setSearchText}
            placeholder={
              tab === "chargers"
                ? "Search charger, suburb, host ID"
                : "Search name or email"
            }
          />

          <SegmentedControl
            segments={[
              { id: "chargers", label: "Chargers" },
              { id: "hosts", label: "Hosts" },
              { id: "drivers", label: "Drivers" },
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as EntityTab)}
            style={styles.segmented}
          />

          {error ? (
            <EmptyStateCard icon="⚠️" title="Action failed" message={error} />
          ) : null}

          {tab === "chargers" ? (
            <FlatList
              data={filteredChargers}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => (
                <AnimatedListItem index={index}>
                  <PressableScale
                    style={styles.card}
                    onPress={() => router.push(`/(app)/chargers/${item.id}` as any)}
                  >
                    <View style={styles.cardHead}>
                      <View style={styles.iconCircle}>
                        <Ionicons name="flash" size={18} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {item.suburb}, {item.state} · {item.maxPowerKw}kW · ${item.pricingPerKwh.toFixed(2)}/kWh
                        </Text>
                      </View>
                      <ChargerStatusBadge status={item.status} />
                    </View>
                    <View style={styles.actionRow}>
                      <PressableScale
                        onPress={() => confirmDeleteCharger(item)}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={15} color={Colors.error} />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </PressableScale>
                    </View>
                  </PressableScale>
                </AnimatedListItem>
              )}
              ListEmptyComponent={
                chargersQuery.isLoading ? null : (
                  <EmptyStateCard
                    icon="⚡"
                    title="No chargers"
                    message="No chargers match the current search."
                  />
                )
              }
            />
          ) : (
            <FlatList
              data={tab === "hosts" ? filteredHosts : filteredDrivers}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => (
                <AnimatedListItem index={index}>
                  <View style={styles.card}>
                    <View style={styles.cardHead}>
                      <Avatar name={item.displayName || item.email} size="sm" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.displayName || "—"}
                        </Text>
                        <Text style={styles.cardMeta} numberOfLines={1}>
                          {item.email}
                        </Text>
                      </View>
                      {item.isSuspended ? (
                        <InfoPill label="Suspended" variant="error" />
                      ) : (
                        <InfoPill label={item.role} variant="info" />
                      )}
                    </View>
                    <View style={styles.actionRow}>
                      <PressableScale
                        onPress={() => toggleSuspend(item)}
                        style={styles.suspendBtn}
                      >
                        <Ionicons
                          name={item.isSuspended ? "checkmark-circle-outline" : "ban-outline"}
                          size={15}
                          color={item.isSuspended ? Colors.primary : Colors.warning}
                        />
                        <Text style={[styles.suspendBtnText, { color: item.isSuspended ? Colors.primary : Colors.warning }]}>
                          {item.isSuspended ? "Reinstate" : "Suspend"}
                        </Text>
                      </PressableScale>
                      <PressableScale
                        onPress={() => confirmDeleteUser(item)}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={15} color={Colors.error} />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </PressableScale>
                    </View>
                  </View>
                </AnimatedListItem>
              )}
              ListEmptyComponent={
                usersQuery.isLoading ? null : (
                  <EmptyStateCard
                    icon="👤"
                    title={tab === "hosts" ? "No hosts" : "No drivers"}
                    message="No users match the current search."
                  />
                )
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
  segmented: {
    marginVertical: Spacing.md,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  cardMeta: {
    ...Typography.caption,
    marginTop: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  suspendBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.pill,
    paddingVertical: 9,
  },
  suspendBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.pill,
    paddingVertical: 9,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.error,
  },
});
