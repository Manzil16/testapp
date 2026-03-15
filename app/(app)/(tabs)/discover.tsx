import { useMemo, useRef } from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Callout, Marker, type Region } from "react-native-maps";
import Animated from "react-native-reanimated";
import {
  AnimatedListItem,
  ChargerCardPremium,
  ChargerCardSkeleton,
  EmptyStateCard,
  FilterChipRow,
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
import { useChargerDiscovery, useEntranceAnimation, useRefresh } from "@/src/hooks";

const defaultRegion: Region = {
  latitude: -33.8688,
  longitude: 151.2093,
  latitudeDelta: 0.6,
  longitudeDelta: 0.6,
};

export default function DiscoverScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const entranceStyle = useEntranceAnimation();

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

  const currentRegion = useMemo<Region>(() => {
    const first = data.all[0];
    if (!first) {
      return defaultRegion;
    }

    return {
      latitude: first.latitude,
      longitude: first.longitude,
      latitudeDelta: 0.22,
      longitudeDelta: 0.22,
    };
  }, [data.all]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
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
                {data.all.map((charger) => {
                  const pinColor = Colors.mapAvailable;

                  return (
                    <Marker
                      key={charger.id}
                      coordinate={{ latitude: charger.latitude, longitude: charger.longitude }}
                      pinColor={pinColor}
                    >
                      <Callout onPress={() => router.push(`/(app)/chargers/${charger.id}` as any)}>
                        <View style={styles.callout}>
                          <Text style={styles.calloutTitle}>{charger.name}</Text>
                          <Text style={styles.calloutText}>{charger.maxPowerKw}kW</Text>
                          <Text style={styles.calloutText}>${charger.pricingPerKwh.toFixed(2)}/kWh</Text>
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
                subtitle="Live network listings"
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
                  data={data.chargers}
                  keyExtractor={(item) => item.id}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                  onEndReached={actions.loadMore}
                  onEndReachedThreshold={0.4}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item, index }) => (
                    <AnimatedListItem index={index}>
                      <ChargerCardPremium
                        charger={{
                          id: item.id,
                          name: item.name,
                          address: `${item.suburb}, ${item.state}`,
                          powerKw: item.maxPowerKw,
                          connectorTypes: item.connectors.map((c) => c.type),
                          pricePerKwh: item.pricingPerKwh,
                          badge: item.verificationScore > 85 ? "verified" : "community",
                          available: item.status === "verified",
                        }}
                        onPress={() => router.push(`/(app)/chargers/${item.id}` as any)}
                      />
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
  callout: {
    minWidth: 140,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  calloutTitle: {
    ...Typography.cardTitle,
  },
  calloutText: {
    ...Typography.caption,
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
});
