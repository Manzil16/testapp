import { useMemo, useRef } from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Callout, Circle, Marker, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import {
  AnimatedListItem,
  ChargerCardPremium,
  ChargerCardSkeleton,
  EmptyStateCard,
  FilterChipRow,
  PressableScale,
  PrimaryCTA,
  ScreenContainer,
  SearchBar,
  SectionTitle,
  SegmentedControl,
  Colors,
  Radius,
  Spacing,
  Typography,
} from "@/src/components";
import { useChargerDiscovery, useEntranceAnimation, useRefresh, useWishlist } from "@/src/hooks";
import { useUserLocation, getDistanceKm, formatDistance } from "@/src/hooks/useUserLocation";
import { useThemeColors } from "@/src/hooks/useThemeColors";
import { AppConfig } from "@/src/constants/app";

export default function DiscoverScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const entranceStyle = useEntranceAnimation();
  const colors = useThemeColors();
  const { location } = useUserLocation();
  const { isSaved, toggleSaved } = useWishlist();

  const { data, isLoading, error, refresh, actions } = useChargerDiscovery();
  const { refreshing, onRefresh } = useRefresh(refresh);

  const connectorChips = useMemo(
    () => [
      { id: "any", label: "Any" },
      { id: "Type2", label: "Type 2" },
      { id: "CCS2", label: "CCS" },
      { id: "CHAdeMO", label: "CHAdeMO" },
      { id: "Tesla", label: "Tesla" },
    ],
    []
  );

  const powerChips = useMemo(
    () => [
      { id: "any", label: "Any" },
      { id: "7", label: "7kW+" },
      { id: "22", label: "22kW+" },
      { id: "50", label: "50kW+" },
    ],
    []
  );

  // Center on user location, zoom tight to show nearby chargers
  const currentRegion = useMemo<Region>(() => {
    if (location) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    const first = data.all[0];
    if (first) {
      return {
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.22,
        longitudeDelta: 0.22,
      };
    }
    return AppConfig.DEFAULT_REGION;
  }, [data.all, location]);

  // Add distance to chargers and sort by proximity for list view
  const chargersWithDistance = useMemo(() => {
    const withDist = data.chargers.map((c) => ({
      ...c,
      distanceKm: location
        ? getDistanceKm(location.latitude, location.longitude, c.latitude, c.longitude)
        : null,
    }));

    // Sort by distance from user — nearest first
    withDist.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    return withDist;
  }, [data.chargers, location]);

  const handleShare = async (charger: { id: string; name: string; suburb: string }) => {
    await Share.share({
      message: `Check out ${charger.name} on VehicleGrid — EV charging in ${charger.suburb}!`,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <Text style={Typography.pageTitle}>Explore Chargers</Text>
          <Text style={Typography.body}>Map and list discovery with live availability.</Text>

          <View style={styles.controlsWrap}>
            <SearchBar
              value={data.searchText}
              onChangeText={actions.setSearchText}
              placeholder="Search suburb, charger, or address"
            />
            <FilterChipRow
              chips={connectorChips}
              activeId={data.connectorFilter}
              onSelect={(id) => actions.setConnectorFilter(id as any)}
            />
            <FilterChipRow
              chips={powerChips}
              activeId={data.minPowerFilter}
              onSelect={(id) => actions.setMinPowerFilter(id as any)}
            />
            <SegmentedControl
              segments={[
                { id: "map", label: "Map" },
                { id: "list", label: "List" },
              ]}
              activeId={data.viewMode}
              onChange={(id) => actions.setViewMode(id as any)}
            />
          </View>

          {data.viewMode === "map" ? (
            <View style={styles.mapWrap}>
              <MapView ref={mapRef} style={styles.map} initialRegion={currentRegion}>
                {/* User location marker */}
                {location && (
                  <>
                    <Marker
                      coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.userMarkerOuter}>
                        <View style={styles.userMarkerInner} />
                      </View>
                    </Marker>
                    <Circle
                      center={{ latitude: location.latitude, longitude: location.longitude }}
                      radius={80}
                      fillColor="rgba(0, 191, 165, 0.10)"
                      strokeColor="rgba(0, 191, 165, 0.25)"
                      strokeWidth={1}
                    />
                  </>
                )}

                {/* Charger markers with price labels */}
                {data.all.map((charger) => {
                  const dist = location
                    ? getDistanceKm(location.latitude, location.longitude, charger.latitude, charger.longitude)
                    : null;

                  return (
                    <Marker
                      key={charger.id}
                      coordinate={{ latitude: charger.latitude, longitude: charger.longitude }}
                    >
                      <View style={styles.priceMarker}>
                        <Text style={styles.priceMarkerText}>
                          ${charger.pricingPerKwh.toFixed(2)}
                        </Text>
                      </View>
                      <Callout onPress={() => router.push(`/(app)/chargers/${charger.id}` as any)}>
                        <View style={styles.callout}>
                          <Text style={styles.calloutTitle}>{charger.name}</Text>
                          <Text style={styles.calloutText}>{charger.maxPowerKw}kW</Text>
                          <Text style={styles.calloutText}>${charger.pricingPerKwh.toFixed(2)}/kWh</Text>
                          {dist !== null && (
                            <Text style={styles.calloutText}>{formatDistance(dist)} away</Text>
                          )}
                        </View>
                      </Callout>
                    </Marker>
                  );
                })}
              </MapView>

              <PrimaryCTA
                label="Re-center"
                onPress={() => mapRef.current?.animateToRegion(currentRegion, 260)}
                style={styles.recenterBtn}
              />

              {!data.all.length && !isLoading ? (
                <EmptyStateCard
                  icon="🗺️"
                  title="No chargers found"
                  message="Try broadening connector or power filters."
                  actionLabel="Reset Filters"
                  onAction={() => {
                    actions.setConnectorFilter("any");
                    actions.setMinPowerFilter("any");
                    actions.setSearchText("");
                  }}
                  style={styles.emptyOverlay}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.listWrap}>
              <SectionTitle
                title={`${data.total} chargers`}
                subtitle="Sorted by distance"
                topSpacing={Spacing.sm}
              />
              {isLoading ? (
                <View>
                  <ChargerCardSkeleton />
                  <ChargerCardSkeleton />
                  <ChargerCardSkeleton />
                </View>
              ) : (
                <FlatList
                  data={chargersWithDistance}
                  keyExtractor={(item) => item.id}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                  onEndReached={actions.loadMore}
                  onEndReachedThreshold={0.4}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item, index }) => (
                    <AnimatedListItem index={index}>
                      <View>
                        <ChargerCardPremium
                          charger={{
                            id: item.id,
                            name: item.name,
                            address: `${item.suburb}, ${item.state}`,
                            powerKw: item.maxPowerKw,
                            connectorTypes: item.connectors.map((c) => c.type),
                            pricePerKwh: item.pricingPerKwh,
                            imageSource: item.images?.[0],
                            badge: item.verificationScore > AppConfig.VERIFICATION.verifiedThreshold ? "verified" : "community",
                            available: item.status === "approved",
                          }}
                          onPress={() => router.push(`/(app)/chargers/${item.id}` as any)}
                        />
                        {/* Airbnb-style action row */}
                        <View style={styles.cardActions}>
                          {item.distanceKm !== null && (
                            <View style={styles.distanceChip}>
                              <Ionicons name="location-outline" size={12} color={Colors.primary} />
                              <Text style={styles.distanceText}>{formatDistance(item.distanceKm)}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }} />
                          <PressableScale onPress={() => toggleSaved(item.id)} style={styles.actionBtn}>
                            <Ionicons
                              name={isSaved(item.id) ? "heart" : "heart-outline"}
                              size={18}
                              color={isSaved(item.id) ? Colors.error : Colors.textMuted}
                            />
                          </PressableScale>
                          <PressableScale
                            onPress={() => handleShare({ id: item.id, name: item.name, suburb: item.suburb })}
                            style={styles.actionBtn}
                          >
                            <Ionicons name="share-outline" size={18} color={Colors.textMuted} />
                          </PressableScale>
                        </View>
                      </View>
                    </AnimatedListItem>
                  )}
                  ListEmptyComponent={
                    <EmptyStateCard
                      icon="🔍"
                      title="Nothing matches those filters"
                      message={error || "Try a different connector or lower minimum power."}
                      actionLabel="Clear Filters"
                      onAction={() => {
                        actions.setConnectorFilter("any");
                        actions.setMinPowerFilter("any");
                        actions.setSearchText("");
                      }}
                    />
                  }
                />
              )}
            </View>
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
  controlsWrap: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  mapWrap: {
    flex: 1,
    marginTop: Spacing.md,
  },
  map: {
    flex: 1,
    borderRadius: Radius.xl,
  },
  recenterBtn: {
    position: "absolute",
    right: Spacing.md,
    bottom: Spacing.md,
    width: 120,
    height: 46,
  },
  // User location marker
  userMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 191, 165, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  // Price marker (Airbnb-style)
  priceMarker: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  priceMarkerText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  callout: {
    minWidth: 140,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  calloutTitle: {
    ...Typography.cardTitle,
    color: "#111827",
  },
  calloutText: {
    ...Typography.caption,
    color: "#6B7280",
  },
  emptyOverlay: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    top: Spacing.md,
  },
  listWrap: {
    flex: 1,
    marginTop: Spacing.xs,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  // Card action row (save + share)
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  distanceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  distanceText: {
    ...Typography.badge,
    color: Colors.primary,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
});
