import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AnimatedListItem,
  Avatar,
  BottomSheet,
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
import { listChargers, updateChargerStatus, type Charger } from "@/src/features/chargers";
import { getUserProfile } from "@/src/features/users/user.repository";
import { AppConfig } from "@/src/constants/app";
import { useEntranceAnimation, useRefresh } from "@/src/hooks";
import { useThemeColors } from "@/src/hooks/useThemeColors";

function formatResponseTime(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export default function AdminTrustTabScreen() {
  const entranceStyle = useEntranceAnimation();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "rejected" | "flagged">("all");
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Charger | null>(null);

  const chargersQuery = useQuery({
    queryKey: ["chargers", "all"],
    queryFn: () => listChargers(),
  });

  const chargers = useMemo(() => chargersQuery.data ?? [], [chargersQuery.data]);
  const isLoading = chargersQuery.isLoading;

  // Resolve host names
  const hostIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of chargers) ids.add(c.hostUserId);
    return Array.from(ids);
  }, [chargers]);

  const hostsQuery = useQuery({
    queryKey: ["profiles", "hosts", hostIds],
    queryFn: async () => {
      const results: Record<string, { displayName: string; avgResponseMinutes?: number }> = {};
      await Promise.all(
        hostIds.map(async (id) => {
          try {
            const profile = await getUserProfile(id);
            if (profile) {
              results[id] = {
                displayName: profile.displayName,
                avgResponseMinutes: (profile as any).avgResponseMinutes,
              };
            }
          } catch { /* skip */ }
        })
      );
      return results;
    },
    enabled: hostIds.length > 0,
  });

  const hostProfiles = hostsQuery.data ?? {};
  const hostNames: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, p] of Object.entries(hostProfiles)) map[id] = p.displayName;
    return map;
  }, [hostProfiles]);

  const refresh = async () => {
    await chargersQuery.refetch();
  };
  const { refreshing, onRefresh } = useRefresh(refresh);

  const normalizedSearch = searchText.trim().toLowerCase();

  const watchlist = useMemo(() => {
    const flagged = chargers.filter(
      (item) =>
        item.status === "pending" || item.status === "rejected" || item.verificationScore < AppConfig.VERIFICATION.flaggedThreshold
    );

    let filtered = flagged;
    if (filter === "flagged") {
      filtered = filtered.filter((item) => item.verificationScore < AppConfig.VERIFICATION.flaggedThreshold);
    } else if (filter !== "all") {
      filtered = filtered.filter((item) => item.status === filter);
    }

    if (normalizedSearch) {
      filtered = filtered.filter((item) => {
        const hostName = hostNames[item.hostUserId] || "";
        const haystack = `${item.name} ${item.suburb} ${item.state} ${hostName}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    return filtered;
  }, [chargers, filter, normalizedSearch, hostNames]);

  const reinstate = async (charger: Charger) => {
    try {
      await updateChargerStatus(charger.id, "approved", AppConfig.VERIFICATION.reinstateScore);
      queryClient.invalidateQueries({ queryKey: ["chargers"] });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reinstate charger.");
    }
  };

  const reject = async (charger: Charger) => {
    try {
      await updateChargerStatus(charger.id, "rejected", 10);
      queryClient.invalidateQueries({ queryKey: ["chargers"] });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reject charger.");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <Text style={Typography.pageTitle}>Trust Watchlist</Text>
          <Text style={Typography.body}>Monitor flagged and rejected chargers.</Text>

          <SearchBar
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search charger, suburb, or host"
          />

          <SegmentedControl
            segments={[
              { id: "all", label: "All" },
              { id: "pending", label: "Pending" },
              { id: "rejected", label: "Rejected" },
              { id: "flagged", label: "Flagged" },
            ]}
            activeId={filter}
            onChange={(id) => setFilter(id as any)}
            style={styles.segmented}
          />

          {error ? (
            <EmptyStateCard icon="⚠️" title="Trust action failed" message={error} />
          ) : null}

          <FlatList
            data={watchlist}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00BFA5" />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const isRejected = item.status === "rejected";
              const connectorTypes = item.connectors.map((c) => c.type).join(", ") || "Unknown";
              const hostName = hostNames[item.hostUserId] || item.hostUserId.slice(0, 8);

              return (
                <AnimatedListItem index={index}>
                  <PressableScale
                    style={[styles.card, isRejected && styles.cardFlagged]}
                    onPress={() => setSelected(item)}
                  >
                    {/* Status accent bar */}
                    <View
                      style={[
                        styles.cardAccent,
                        {
                          backgroundColor:
                            item.status === "rejected"
                              ? Colors.error
                              : item.status === "pending"
                              ? Colors.warning
                              : Colors.primary,
                        },
                      ]}
                    />

                    <View style={styles.cardBody}>
                      {/* Header row */}
                      <View style={styles.cardHead}>
                        <View style={styles.chargerIconCircle}>
                          <Ionicons name="flash" size={18} color={Colors.warning} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.cardMeta}>
                            {item.suburb}, {item.state}
                          </Text>
                        </View>
                        <ChargerStatusBadge status={item.status} />
                      </View>

                      {/* Specs row */}
                      <View style={styles.specsRow}>
                        <View style={styles.specItem}>
                          <Ionicons name="speedometer-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.specText}>{item.maxPowerKw} kW</Text>
                        </View>
                        <View style={styles.specItem}>
                          <Ionicons name="hardware-chip-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.specText}>{connectorTypes}</Text>
                        </View>
                        <View style={styles.specItem}>
                          <Ionicons name="pricetag-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.specText}>${item.pricingPerKwh.toFixed(2)}/kWh</Text>
                        </View>
                      </View>

                      {/* Host row */}
                      <View style={styles.hostRow}>
                        <Avatar name={hostName} size="sm" />
                        <Text style={styles.hostText}>Host: {hostName}</Text>
                        {hostProfiles[item.hostUserId]?.avgResponseMinutes != null && (
                          <InfoPill
                            label={`⏱ ${formatResponseTime(hostProfiles[item.hostUserId].avgResponseMinutes!)}`}
                            variant="info"
                          />
                        )}
                      </View>

                      {/* Actions */}
                      <View style={styles.trustActions}>
                        {item.status !== "rejected" ? (
                          <PressableScale onPress={() => reject(item)} style={styles.suspendBtn}>
                            <Ionicons name="close" size={16} color={Colors.error} />
                            <Text style={styles.suspendBtnText}>Reject</Text>
                          </PressableScale>
                        ) : null}
                        <PressableScale onPress={() => reinstate(item)} style={styles.reinstateBtn}>
                          <Ionicons name="checkmark" size={16} color={Colors.primary} />
                          <Text style={styles.reinstateBtnText}>Reinstate</Text>
                        </PressableScale>
                      </View>
                    </View>
                  </PressableScale>
                </AnimatedListItem>
              );
            }}
            ListEmptyComponent={
              isLoading ? null : (
                <EmptyStateCard
                  icon="🛡️"
                  title="Watchlist is clear"
                  message="No flagged chargers match current filter."
                />
              )
            }
          />
        </ScreenContainer>
      </Animated.View>

      {/* Detail Bottom Sheet */}
      <BottomSheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Charger Detail"
      >
        {selected ? (
          <View style={styles.sheetContent}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIconCircle}>
                <Ionicons name="flash" size={24} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{selected.name}</Text>
                <Text style={styles.sheetSubtitle}>
                  {selected.suburb}, {selected.state}
                </Text>
              </View>
              <ChargerStatusBadge status={selected.status} />
            </View>

            {/* Info Grid */}
            <View style={styles.sheetGrid}>
              <View style={styles.sheetGridItem}>
                <Ionicons name="speedometer-outline" size={18} color={Colors.primary} />
                <Text style={styles.sheetGridValue}>{selected.maxPowerKw} kW</Text>
                <Text style={styles.sheetGridLabel}>Power</Text>
              </View>
              <View style={styles.sheetGridItem}>
                <Ionicons name="pricetag-outline" size={18} color={Colors.primary} />
                <Text style={styles.sheetGridValue}>${selected.pricingPerKwh.toFixed(2)}</Text>
                <Text style={styles.sheetGridLabel}>Per kWh</Text>
              </View>
              <View style={styles.sheetGridItem}>
                <Ionicons name="hardware-chip-outline" size={18} color={Colors.primary} />
                <Text style={styles.sheetGridValue}>
                  {selected.connectors.map((c) => c.type).join(", ") || "N/A"}
                </Text>
                <Text style={styles.sheetGridLabel}>Connectors</Text>
              </View>
            </View>

            {/* Host info */}
            <View style={styles.sheetHostRow}>
              <Avatar name={hostNames[selected.hostUserId] || "Host"} size="md" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetHostName}>
                  {hostNames[selected.hostUserId] || selected.hostUserId.slice(0, 12)}
                </Text>
                <Text style={styles.sheetHostLabel}>Charger Host</Text>
                {hostProfiles[selected.hostUserId]?.avgResponseMinutes != null && (
                  <Text style={styles.sheetHostLabel}>
                    Avg response: {formatResponseTime(hostProfiles[selected.hostUserId].avgResponseMinutes!)}
                  </Text>
                )}
              </View>
            </View>

            {/* Submitted date */}
            <View style={styles.sheetDetailRow}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.sheetDetailText}>
                Submitted: {new Date(selected.createdAtIso).toLocaleDateString()} at{" "}
                {new Date(selected.createdAtIso).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>

            {selected.amenities?.length > 0 && (
              <View style={styles.sheetDetailRow}>
                <Ionicons name="cafe-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.sheetDetailText}>
                  Amenities: {selected.amenities.join(", ")}
                </Text>
              </View>
            )}
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
    overflow: "hidden",
    ...Shadows.card,
  },
  cardFlagged: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  cardAccent: {
    height: 3,
  },
  cardBody: {
    padding: Spacing.lg,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  chargerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  cardMeta: {
    ...Typography.caption,
    marginTop: 1,
  },
  specsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  hostText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  trustActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  suspendBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.pill,
    paddingVertical: 10,
  },
  suspendBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.error,
  },
  reinstateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill,
    paddingVertical: 10,
  },
  reinstateBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },

  // Bottom Sheet
  sheetContent: {
    gap: Spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  sheetIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  sheetSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  sheetGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  sheetGridItem: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: "center",
    gap: 4,
  },
  sheetGridValue: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  sheetGridLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  sheetHostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  sheetHostName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  sheetHostLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  sheetDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sheetDetailText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
  },
});
