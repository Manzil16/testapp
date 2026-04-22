import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  EmptyStateCard,
  InfoPill,
  InputField,
  PrimaryCTA,
  ProgressStepper,
  ScreenContainer,
  SearchBar,
  SectionDivider,
  SectionTitle,
  Typography,
  Colors,
  Radius,
  Spacing,
  Shadows,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { useTripPlanner } from "@/src/hooks";

function computeRouteRegion(points: { latitude: number; longitude: number }[]): Region {
  if (points.length === 0) {
    return { latitude: 0, longitude: 0, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  }
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;
  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.02),
  };
}

export default function TripPlannerScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const mapRef = useRef<MapView>(null);

  const userId = useMemo(
    () => user?.id,
    [user?.id]
  );

  const { data, isLoading, isPlanning, error, actions } = useTripPlanner(
    userId,
    profile?.preferredReservePercent
  );

  const activeStep = !data.origin || !data.destination
    ? "locations"
    : !data.summary
    ? "vehicle"
    : "summary";

  useEffect(() => {
    if (!data.summary || !data.origin || !data.destination) return;
    const coords = [
      ...data.summary.routePoints,
      { latitude: data.origin.latitude, longitude: data.origin.longitude },
      { latitude: data.destination.latitude, longitude: data.destination.longitude },
      ...data.summary.suggestedChargers.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
    ];
    if (coords.length < 2) return;
    const id = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
        animated: true,
      });
    }, 120);
    return () => clearTimeout(id);
  }, [data.summary, data.origin, data.destination]);

  const openInMaps = async () => {
    if (!data.origin || !data.destination) {
      return;
    }

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${data.origin.latitude},${data.origin.longitude}` +
      `&destination=${data.destination.latitude},${data.destination.longitude}` +
      `&travelmode=driving`;
    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer>
        <Animated.View entering={FadeIn.duration(260)}>
          <Text style={Typography.pageTitle}>Trip Planner</Text>
          <Text style={Typography.body}>Plan route, estimate battery, and save the trip.</Text>
        </Animated.View>

        <ProgressStepper
          steps={[
            { id: "locations", label: "Locations" },
            { id: "vehicle", label: "Vehicle" },
            { id: "summary", label: "Summary" },
          ]}
          activeId={activeStep}
          style={styles.stepper}
        />

        <Animated.View entering={FadeInDown.duration(260)} style={styles.card}>
          <SectionTitle title="Origin" topSpacing={Spacing.xs} />
          <SearchBar
            value={data.originQuery}
            onChangeText={actions.setOriginQuery}
            placeholder="Search origin"
          />
          {data.origin ? <Text style={styles.selectionHint}>Selected: {data.origin.displayName}</Text> : null}
          {data.isOriginSearching ? <ActivityIndicator color={Colors.primary} style={styles.spinner} /> : null}
          {!data.isOriginSearching &&
          !data.origin &&
          data.originQuery.trim().length >= 3 &&
          data.originResults.length === 0 &&
          data.originSearchError ? (
            <Text style={styles.errorHint}>Address search unavailable — check your connection and try again.</Text>
          ) : null}
          {data.originResults.length > 0 ? (
            <FlatList
              data={data.originResults}
              keyExtractor={(item, index) => `${item.displayName}-${index}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => actions.selectOrigin(item)}>
                  <Text style={styles.resultPrimary}>{item.primaryText || item.displayName}</Text>
                  <Text style={styles.resultSecondary} numberOfLines={2}>
                    {item.secondaryText || item.displayName}
                  </Text>
                </TouchableOpacity>
              )}
            />
          ) : null}

          <SectionTitle title="Destination" topSpacing={Spacing.md} />
          <SearchBar
            value={data.destinationQuery}
            onChangeText={actions.setDestinationQuery}
            placeholder="Search destination"
          />
          {data.destination ? (
            <Text style={styles.selectionHint}>Selected: {data.destination.displayName}</Text>
          ) : null}
          {data.isDestinationSearching ? <ActivityIndicator color={Colors.primary} style={styles.spinner} /> : null}
          {!data.isDestinationSearching &&
          !data.destination &&
          data.destinationQuery.trim().length >= 3 &&
          data.destinationResults.length === 0 &&
          data.destinationSearchError ? (
            <Text style={styles.errorHint}>Address search unavailable — check your connection and try again.</Text>
          ) : null}
          {data.destinationResults.length > 0 ? (
            <FlatList
              data={data.destinationResults}
              keyExtractor={(item, index) => `${item.displayName}-${index}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => actions.selectDestination(item)}>
                  <Text style={styles.resultPrimary}>{item.primaryText || item.displayName}</Text>
                  <Text style={styles.resultSecondary} numberOfLines={2}>
                    {item.secondaryText || item.displayName}
                  </Text>
                </TouchableOpacity>
              )}
            />
          ) : null}

          <SectionDivider spacing={Spacing.lg} />

          <SectionTitle title="Battery Inputs" topSpacing={Spacing.xs} />
          <InputField
            label="Current Battery %"
            value={data.batteryPercent}
            onChangeText={actions.setBatteryPercent}
            keyboardType="numeric"
          />
          <InputField
            label="Vehicle Range (km)"
            value={data.vehicleRangeKm}
            onChangeText={actions.setVehicleRangeKm}
            keyboardType="numeric"
            hint={data.primaryVehicle ? `${data.primaryVehicle.make} ${data.primaryVehicle.model}` : undefined}
          />

          <PrimaryCTA
            label={isPlanning ? "Calculating..." : "Plan & Save Trip"}
            onPress={actions.planTrip}
            loading={isPlanning}
            disabled={!data.origin || !data.destination}
          />
        </Animated.View>

        {error ? (
          <EmptyStateCard
            icon="⚠️"
            title="Trip planner error"
            message={error}
            actionLabel="Try again"
            onAction={actions.planTrip}
          />
        ) : null}

        {data.summary ? (
          <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.card}>
            <SectionTitle title="Route Summary" topSpacing={Spacing.xs} />
            <View style={styles.metricRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Distance</Text>
                <Text style={styles.metricValue}>{data.summary.distanceKm.toFixed(1)} km</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Duration</Text>
                <Text style={styles.metricValue}>{data.summary.durationMinutes.toFixed(0)} mins</Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Battery Used</Text>
                <Text style={styles.metricValue}>{(Number(data.batteryPercent) - data.summary.projectedArrivalPercent).toFixed(1)}%</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Arrival</Text>
                <Text style={styles.metricValue}>{data.summary.projectedArrivalPercent.toFixed(1)}%</Text>
              </View>
            </View>

            {/* Embedded map with polyline + charger pins */}
            {data.summary.routePoints.length > 1 && data.origin && data.destination ? (
              <View style={styles.mapWrap}>
                <MapView
                  ref={mapRef}
                  style={styles.tripMap}
                  initialRegion={computeRouteRegion(data.summary.routePoints)}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Polyline
                    coordinates={data.summary.routePoints}
                    strokeColor={Colors.primary}
                    strokeWidth={4}
                  />
                  <Marker
                    coordinate={{ latitude: data.origin.latitude, longitude: data.origin.longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={[styles.endpointPin, { backgroundColor: Colors.success }]}>
                      <Text style={styles.endpointText}>A</Text>
                    </View>
                  </Marker>
                  <Marker
                    coordinate={{ latitude: data.destination.latitude, longitude: data.destination.longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={[styles.endpointPin, { backgroundColor: Colors.error }]}>
                      <Text style={styles.endpointText}>B</Text>
                    </View>
                  </Marker>
                  {data.summary.suggestedChargers.map((c) => (
                    <Marker
                      key={c.id}
                      coordinate={{ latitude: c.latitude, longitude: c.longitude }}
                      anchor={{ x: 0.5, y: 0.5 }}
                      stopPropagation
                      tracksViewChanges={false}
                      onPress={() => router.push(`/(app)/chargers/${c.id}` as any)}
                    >
                      <View style={styles.chargerPin}>
                        <Text style={styles.chargerPinText}>
                          ${c.pricingPerKwh.toFixed(2)}
                        </Text>
                      </View>
                    </Marker>
                  ))}
                </MapView>
              </View>
            ) : null}

            {data.summary.needsCharge ? (
              <>
                <SectionTitle
                  title="Chargers along your route"
                  subtitle={
                    data.primaryVehicle?.connectorType
                      ? `Within 5 km · compatible with ${data.primaryVehicle.connectorType}`
                      : "Within 5 km of your route"
                  }
                  topSpacing={Spacing.md}
                />
                {data.summary.suggestedChargers.length === 0 ? (
                  <EmptyStateCard
                    icon="🔋"
                    title="No compatible chargers along this route"
                    message={
                      data.primaryVehicle?.connectorType
                        ? `No ${data.primaryVehicle.connectorType} chargers within 5 km of your route. Try a different route or check back later.`
                        : "No chargers within 5 km of this route. Try a different route."
                    }
                  />
                ) : (
                  <FlatList
                    data={data.summary.suggestedChargers}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.recommendCard}
                        onPress={() => router.push(`/(app)/chargers/${item.id}` as any)}
                      >
                        <View style={styles.recommendHeaderRow}>
                          <Text style={styles.recommendName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.recommendPrice}>
                            ${item.pricingPerKwh.toFixed(2)}/kWh
                          </Text>
                        </View>
                        <Text style={styles.recommendMeta} numberOfLines={2}>
                          {item.address}
                        </Text>
                        <View style={styles.recommendPillRow}>
                          <InfoPill
                            label={`${item.detourKm.toFixed(1)} km off route`}
                            variant="primary"
                          />
                          <InfoPill label={`${item.maxPowerKw}kW`} variant="default" />
                          {item.connectorTypes.slice(0, 2).map((c) => (
                            <InfoPill key={c} label={c} variant="default" />
                          ))}
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            ) : (
              <EmptyStateCard
                icon="✅"
                title="Direct route feasible"
                message="You can complete this trip without an intermediate charge."
              />
            )}

            <PrimaryCTA label="Open in Google Maps" onPress={openInMaps} style={styles.mapsBtn} />
          </Animated.View>
        ) : isLoading ? (
          <Animated.View entering={FadeInDown.duration(240)} style={styles.card}>
            <ActivityIndicator color={Colors.primary} />
          </Animated.View>
        ) : null}

        {data.savedTrips.length > 0 && !data.summary ? (
          <Animated.View entering={FadeInDown.delay(100).duration(260)} style={styles.card}>
            <SectionTitle title="Trip History" topSpacing={Spacing.xs} />
            {data.savedTrips.slice(0, 5).map((trip) => (
              <View key={trip.id} style={styles.tripHistoryRow}>
                <View style={styles.tripHistoryContent}>
                  <Text style={styles.tripHistoryLabel}>
                    {trip.origin.label} → {trip.destination.label}
                  </Text>
                  <Text style={styles.tripHistoryMeta}>
                    {trip.distanceKm.toFixed(0)} km • {trip.durationMinutes.toFixed(0)} min • {new Date(trip.createdAtIso).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[
                  styles.tripHistoryBattery,
                  { color: trip.projectedArrivalPercent > 20 ? Colors.primary : Colors.error },
                ]}>
                  {trip.projectedArrivalPercent.toFixed(0)}%
                </Text>
              </View>
            ))}
          </Animated.View>
        ) : null}
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  stepper: {
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  spinner: {
    marginTop: Spacing.sm,
  },
  resultRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultPrimary: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  resultSecondary: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  selectionHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  errorHint: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  metricRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  metricBox: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  metricLabel: {
    ...Typography.caption,
  },
  metricValue: {
    ...Typography.cardTitle,
    marginTop: 2,
  },
  recommendCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  recommendName: {
    ...Typography.cardTitle,
  },
  recommendMeta: {
    ...Typography.caption,
    marginTop: 2,
  },
  mapsBtn: {
    marginTop: Spacing.md,
  },
  tripHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tripHistoryLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  tripHistoryMeta: {
    ...Typography.caption,
    marginTop: 2,
  },
  tripHistoryContent: {
    flex: 1,
  },
  tripHistoryBattery: {
    ...Typography.cardTitle,
    marginLeft: Spacing.sm,
  },
  mapWrap: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tripMap: {
    width: "100%",
    height: 240,
  },
  endpointPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.card,
  },
  endpointText: {
    color: Colors.surface,
    fontWeight: "700",
    fontSize: 13,
  },
  chargerPin: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.card,
  },
  chargerPinText: {
    color: Colors.surface,
    fontWeight: "700",
    fontSize: 11,
  },
  recommendHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recommendPrice: {
    ...Typography.cardTitle,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  recommendPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
});
