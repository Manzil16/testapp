import { useCallback, useMemo } from "react";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQueries } from "@tanstack/react-query";
import {
  AnimatedListItem,
  ChargerCardPremium,
  EmptyStateCard,
  PressableScale,
  ScreenContainer,
  Colors,
  Spacing,
  Typography,
  Radius,
  Shadows,
} from "@/src/components";
import { useWishlist } from "@/src/hooks/useWishlist";
import { getChargerById } from "@/src/features/chargers/charger.repository";
import type { Charger } from "@/src/features/chargers/charger.types";

export default function WishlistScreen() {
  const router = useRouter();
  const { savedIds, toggleSaved } = useWishlist();

  const chargerIds = useMemo(() => Array.from(savedIds), [savedIds]);

  const chargerQueries = useQueries({
    queries: chargerIds.map((id) => ({
      queryKey: ["charger", id],
      queryFn: () => getChargerById(id),
      staleTime: 60_000,
    })),
  });

  const chargers = useMemo(
    () =>
      chargerQueries
        .map((q) => q.data)
        .filter((c): c is Charger => c !== null && c !== undefined),
    [chargerQueries]
  );

  const isLoading = chargerQueries.some((q) => q.isLoading);

  const handleRefresh = useCallback(async () => {
    await Promise.all(chargerQueries.map((q) => q.refetch()));
  }, [chargerQueries]);

  const [refreshing, setRefreshing] = useMemo(() => {
    let _refreshing = false;
    const _setRefreshing = async () => {
      _refreshing = true;
      await handleRefresh();
      _refreshing = false;
    };
    return [_refreshing, _setRefreshing] as const;
  }, [handleRefresh]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer scrollable={false}>
        <FlatList
          data={chargers}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && chargerIds.length > 0}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <View style={styles.cardWrap}>
                <ChargerCardPremium
                  charger={{
                    id: item.id,
                    name: item.name,
                    address: item.address,
                    powerKw: item.maxPowerKw,
                    connectorTypes: item.connectors?.map((c: any) =>
                      typeof c === "string" ? c : c.type
                    ) ?? [],
                    pricePerKwh: item.pricingPerKwh,
                    imageSource: item.images?.[0],
                    available: item.status === "approved",
                  }}
                  onPress={() => router.push(`/(app)/chargers/${item.id}` as any)}
                />
                {/* Remove from wishlist button */}
                <PressableScale
                  style={styles.removeBtn}
                  onPress={() => toggleSaved(item.id)}
                >
                  <Ionicons name="heart" size={18} color={Colors.error} />
                  <Text style={styles.removeText}>Remove</Text>
                </PressableScale>
              </View>
            </AnimatedListItem>
          )}
          ListEmptyComponent={
            !isLoading ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                <EmptyStateCard
                  icon="🤍"
                  title="No saved chargers"
                  message="Tap the heart icon on any charger to save it here for quick access."
                  actionLabel="Discover chargers"
                  onAction={() => router.push("/(app)/(tabs)/discover" as any)}
                />
              </Animated.View>
            ) : null
          }
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  cardWrap: {
    marginBottom: Spacing.md,
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginTop: -Spacing.xs,
    backgroundColor: Colors.errorLight,
    borderBottomLeftRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.error + "30",
    ...Shadows.subtle,
  },
  removeText: {
    ...Typography.caption,
    fontWeight: "600" as const,
    color: Colors.error,
  },
});
