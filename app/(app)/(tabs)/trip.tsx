import { useMemo } from "react";
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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  EmptyStateCard,
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

export default function TripPlannerScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

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
          {data.originResults.length > 0 ? (
            <FlatList
              data={data.originResults}
              keyExtractor={(item, index) => `${item.displayName}-${index}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => actions.selectOrigin(item)}>
                  <Text style={styles.resultPrimary}>{item.primaryText || item.displayName}</Text>
                  {item.secondaryText ? (
                    <Text style={styles.resultSecondary}>{item.secondaryText}</Text>
                  ) : null}
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
          {data.destinationResults.length > 0 ? (
            <FlatList
              data={data.destinationResults}
              keyExtractor={(item, index) => `${item.displayName}-${index}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => actions.selectDestination(item)}>
                  <Text style={styles.resultPrimary}>{item.primaryText || item.displayName}</Text>
                  {item.secondaryText ? (
                    <Text style={styles.resultSecondary}>{item.secondaryText}</Text>
                  ) : null}
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
            label={isPlanning ? "Calculating..." : "Save Trip"}
            onPress={actions.planTrip}
            loading={isPlanning}
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

            {data.summary.needsCharge ? (
              <>
                <SectionTitle
                  title="Suggested Chargers"
                  subtitle="Route needs an intermediate charging stop"
                />
                <FlatList
                  data={data.summary.recommendedCharger ? [data.summary.recommendedCharger] : []}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.recommendCard}
                      onPress={() => router.push(`/(app)/chargers/${item.id}` as any)}
                    >
                      <Text style={styles.recommendName}>{item.name}</Text>
                      <Text style={styles.recommendMeta}>
                        {item.address}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <EmptyStateCard
                      icon="🔋"
                      title="No route suggestions"
                      message="Try broadening discovery filters or adjusting battery input."
                    />
                  }
                />
              </>
            ) : (
              <EmptyStateCard
                icon="✅"
                title="Direct route feasible"
                message="You can complete this trip without an intermediate charge."
              />
            )}

            <PrimaryCTA label="Open in Maps" onPress={openInMaps} style={styles.mapsBtn} />
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
});
