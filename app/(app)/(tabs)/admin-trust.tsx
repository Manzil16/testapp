import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import {
  AnimatedListItem,
  ChargerStatusBadge,
  EmptyStateCard,
  InfoPill,
  PressableScale,
  ScreenContainer,
  SearchBar,
  SecondaryButton,
  SegmentedControl,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { listenToChargers, updateChargerStatus, type Charger } from "@/src/features/chargers";
import { useEntranceAnimation, useRefresh } from "@/src/hooks";

export default function AdminTrustTabScreen() {
  const entranceStyle = useEntranceAnimation();
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [filter, setFilter] = useState<"all" | "suspended" | "rejected" | "flagged">("all");
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = listenToChargers(
      (items) => {
        setChargers(items);
        setIsLoading(false);
      },
      undefined,
      (message) => {
        setError(message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const refresh = async () => {
    return;
  };
  const { refreshing, onRefresh } = useRefresh(refresh);

  const normalizedSearch = searchText.trim().toLowerCase();

  const watchlist = useMemo(() => {
    const flagged = chargers.filter(
      (item) =>
        item.status === "suspended" || item.status === "rejected" || item.verificationScore < 45
    );

    let filtered = flagged;
    if (filter === "flagged") {
      filtered = filtered.filter((item) => item.verificationScore < 45);
    } else if (filter !== "all") {
      filtered = filtered.filter((item) => item.status === filter);
    }

    if (normalizedSearch) {
      filtered = filtered.filter((item) => {
        const haystack = `${item.name} ${item.suburb} ${item.state} ${item.hostUserId}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    return filtered;
  }, [chargers, filter, normalizedSearch]);

  const reinstate = async (charger: Charger) => {
    try {
      await updateChargerStatus(charger.id, "verified", 86);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reinstate charger.");
    }
  };

  const suspend = async (charger: Charger) => {
    try {
      await updateChargerStatus(charger.id, "suspended", 10);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to suspend charger.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <Text style={Typography.pageTitle}>Trust Watchlist</Text>
          <Text style={Typography.body}>Monitor flagged and suspended chargers.</Text>

          <SearchBar
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search charger, suburb, or host"
          />

          <SegmentedControl
            segments={[
              { id: "all", label: "All" },
              { id: "suspended", label: "Suspended" },
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const isSuspended = item.status === "suspended";
              return (
                <AnimatedListItem index={index}>
                  <View style={[styles.card, isSuspended && styles.cardFlagged]}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <ChargerStatusBadge status={item.status} />
                    </View>
                    <Text style={styles.cardMeta}>
                      {item.suburb}, {item.state}
                    </Text>

                    {/* Trust score bar */}
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>Trust Score</Text>
                      <View style={styles.scoreBarBg}>
                        <View
                          style={[
                            styles.scoreBarFill,
                            {
                              width: `${Math.min(100, item.verificationScore)}%`,
                              backgroundColor:
                                item.verificationScore > 70
                                  ? Colors.success
                                  : item.verificationScore > 40
                                  ? Colors.warning
                                  : Colors.error,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.scoreValue}>{item.verificationScore}</Text>
                    </View>

                    <View style={styles.trustActions}>
                      {item.status !== "suspended" ? (
                        <PressableScale onPress={() => suspend(item)} style={styles.suspendBtn}>
                          <Text style={styles.suspendBtnText}>Suspend</Text>
                        </PressableScale>
                      ) : null}
                      <PressableScale onPress={() => reinstate(item)} style={styles.reinstateBtn}>
                        <Text style={styles.reinstateBtnText}>Reinstate</Text>
                      </PressableScale>
                    </View>
                  </View>
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
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  cardFlagged: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cardTitle: {
    ...Typography.cardTitle,
    flex: 1,
  },
  cardMeta: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  scoreLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  scoreBarBg: {
    flex: 1,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: 6,
    borderRadius: Radius.full,
  },
  scoreValue: {
    ...Typography.caption,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "right",
  },
  trustActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  suspendBtn: {
    flex: 1,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  suspendBtnText: {
    ...Typography.cardTitle,
    color: Colors.error,
  },
  reinstateBtn: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  reinstateBtnText: {
    ...Typography.cardTitle,
    color: Colors.primary,
  },
});
