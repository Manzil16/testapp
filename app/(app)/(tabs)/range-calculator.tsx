import { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BatterySlider } from "@/src/components/calculator/BatterySlider";
import { useAuth } from "@/src/features/auth/auth-context";
import { useVehicleProfile } from "@/src/hooks";
import { useRoutePlanner } from "@/src/hooks/useRoutePlanner";
import type { RecommendedStop } from "@/src/services/routingService";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import type { GeoResult } from "@/src/services/geocodingService";

// ─── Suggestion dropdown ──────────────────────────────────────────────────────

function SuggestionList({
  results,
  onSelect,
}: {
  results: GeoResult[];
  onSelect: (r: GeoResult) => void;
}) {
  if (results.length === 0) return null;
  return (
    <View style={styles.suggestionBox}>
      {results.map((r, i) => (
        <Pressable
          key={`${r.latitude}-${r.longitude}-${i}`}
          style={[styles.suggestionRow, i < results.length - 1 && styles.suggestionBorder]}
          onPress={() => { Keyboard.dismiss(); onSelect(r); }}
        >
          <Ionicons name="location-outline" size={14} color={Colors.textMuted} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.suggestionPrimary} numberOfLines={1}>{r.primaryText}</Text>
            {r.secondaryText ? (
              <Text style={styles.suggestionSecondary} numberOfLines={1}>{r.secondaryText}</Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Location input ───────────────────────────────────────────────────────────

function LocationInput({
  label,
  icon,
  value,
  confirmed,
  loading,
  suggestions,
  onChangeText,
  onSelect,
  onClear,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  confirmed: boolean;
  loading: boolean;
  suggestions: GeoResult[];
  onChangeText: (t: string) => void;
  onSelect: (r: GeoResult) => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.locationBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, confirmed && styles.inputRowConfirmed]}>
        <Ionicons
          name={icon}
          size={18}
          color={confirmed ? Colors.accent : Colors.textMuted}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.locationInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={`Search ${label.toLowerCase()}…`}
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={Colors.accent} style={styles.inputRight} />
        ) : value.length > 0 ? (
          <Pressable onPress={onClear} style={styles.inputRight}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <SuggestionList results={suggestions} onSelect={onSelect} />
    </View>
  );
}

// ─── Result banner ────────────────────────────────────────────────────────────

function ResultBanner({
  arrivalSoc,
  needsStop,
  distanceKm,
  durationMinutes,
  energyKwh,
  vehicleName,
}: {
  arrivalSoc: number;
  needsStop: boolean;
  distanceKm: number;
  durationMinutes: number;
  energyKwh: number;
  vehicleName: string;
}) {
  const canMakeIt = !needsStop && arrivalSoc >= 15;
  const isLow     = !needsStop && arrivalSoc < 15;

  const bg      = needsStop ? Colors.errorLight  : isLow ? Colors.warningLight : Colors.successLight;
  const border  = needsStop ? Colors.error        : isLow ? Colors.warning      : Colors.success;
  const iconCol = needsStop ? Colors.error        : isLow ? Colors.warning      : Colors.success;
  const icon: keyof typeof Ionicons.glyphMap = needsStop ? "warning" : isLow ? "flash" : "checkmark-circle";
  const headline = needsStop
    ? "Charging required"
    : isLow
    ? "Charge recommended"
    : "You can make it!";
  const sub = needsStop
    ? `You'd arrive at ${Math.round(arrivalSoc)}% — below safe reserve. See stops below.`
    : isLow
    ? `You'd arrive at ${Math.round(arrivalSoc)}% — close to reserve. A top-up is recommended.`
    : `You'll arrive with ${Math.round(arrivalSoc)}% battery remaining.`;

  const hrs  = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durationLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return (
    <View style={[styles.resultBanner, { borderColor: border }]}>
      <View style={[styles.resultHeader, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={iconCol} />
        <Text style={[styles.resultHeadline, { color: iconCol }]}>{headline}</Text>
      </View>
      <View style={styles.resultStats}>
        <StatPill icon="car-outline" label={`${Math.round(distanceKm)} km`} />
        <StatPill icon="time-outline" label={durationLabel} />
        <StatPill icon="flash-outline" label={`${energyKwh} kWh needed`} />
      </View>
      <Text style={styles.resultSub}>{sub}</Text>
      <Text style={styles.resultVehicle}>{vehicleName}</Text>
    </View>
  );
}

function StatPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={13} color={Colors.textSecondary} />
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

// ─── Charging stop card ───────────────────────────────────────────────────────

function StopCard({ stop, index }: { stop: RecommendedStop; index: number }) {
  const router = useRouter();
  const isVg = stop.source === "vehiclegrid";
  const fraction = Math.round(stop.fractionAlongRoute * 100);
  const connectors = stop.connectorTypes.slice(0, 3).join(" · ") || "Unknown";

  function handleBook() {
    if (isVg) {
      router.push(`/(app)/chargers/${stop.chargerId}` as any);
    }
  }

  return (
    <View style={styles.stopCard}>
      {/* Position badge + source badge */}
      <View style={styles.stopHeaderRow}>
        <View style={styles.stopIndexBadge}>
          <Text style={styles.stopIndexText}>Stop {index + 1}</Text>
        </View>
        <Text style={styles.stopFraction}>{fraction}% into trip</Text>
        {isVg && (
          <View style={styles.vgBadge}>
            <Text style={styles.vgBadgeText}>VehicleGrid</Text>
          </View>
        )}
      </View>

      {/* Name + address */}
      <Text style={styles.stopName} numberOfLines={2}>{stop.name}</Text>
      {stop.address ? (
        <Text style={styles.stopAddress} numberOfLines={1}>{stop.address}</Text>
      ) : null}

      {/* Key stats row */}
      <View style={styles.stopStatsRow}>
        <StopStat icon="flash" value={`${stop.maxPowerKw} kW`} label="Power" accent />
        <StopStat icon="time-outline" value={`${stop.estimatedChargeMinutes} min`} label="Charge time" />
        <StopStat
          icon="battery-charging-outline"
          value={`${Math.round(stop.socAtArrivalPercent)}% → ${Math.round(stop.socAfterChargePercent)}%`}
          label="Battery"
        />
      </View>

      {/* Connector types + detour */}
      <View style={styles.stopMetaRow}>
        <Text style={styles.stopConnectors}>{connectors}</Text>
        <Text style={styles.stopDetour}>+{stop.distanceFromRouteKm.toFixed(1)} km detour</Text>
      </View>

      {/* Pricing / action */}
      <View style={styles.stopFooter}>
        <Text style={styles.stopPrice}>
          {isVg && stop.pricePerKwh > 0
            ? `$${stop.pricePerKwh.toFixed(2)}/kWh · ~$${(stop.kwhToAdd * stop.pricePerKwh).toFixed(2)} est.`
            : isVg
            ? "Free"
            : "Pricing via network app"}
        </Text>
        {isVg && (
          <Pressable style={styles.bookBtn} onPress={handleBook}>
            <Text style={styles.bookBtnText}>Book</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function StopStat({
  icon, value, label, accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.stopStat}>
      <Ionicons name={icon} size={14} color={accent ? Colors.accent : Colors.textSecondary} />
      <Text style={[styles.stopStatValue, accent && { color: Colors.accent }]}>{value}</Text>
      <Text style={styles.stopStatLabel}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TripPlannerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: vehicleData, isLoading: vehicleLoading } = useVehicleProfile(user?.id);
  const vehicle = vehicleData.primaryVehicle;

  const {
    originQuery, destinationQuery,
    currentSoc, setCurrentSoc,
    originSuggestions, destinationSuggestions,
    geocodingOrigin, geocodingDestination,
    origin, destination,
    searchOrigin, searchDestination,
    selectOrigin, selectDestination,
    planTrip, canPlan, reset,
    status, result, errorMsg,
  } = useRoutePlanner(vehicle?.id);

  const scrollRef = useRef<ScrollView>(null);

  function clearOrigin() {
    searchOrigin("");
  }
  function clearDest() {
    searchDestination("");
  }

  const showStops = status === "done" && result && result.recommendedStops.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.pageTitle}>Trip Planner</Text>
        <Text style={styles.pageSubtitle}>
          Enter your destination to see if you can make it and find chargers along the way.
        </Text>

        {/* No vehicle warning */}
        {!vehicleLoading && !vehicle && (
          <Pressable
            style={styles.noVehicleCard}
            onPress={() => router.push("/(app)/driver/vehicle" as any)}
          >
            <Ionicons name="car-outline" size={20} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noVehicleTitle}>Add your vehicle first</Text>
              <Text style={styles.noVehicleBody}>
                We need your battery size and efficiency to plan your trip accurately.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
        )}

        {/* Vehicle pill */}
        {vehicle && (
          <Pressable
            style={styles.vehiclePill}
            onPress={() => router.push("/(app)/driver/vehicle" as any)}
          >
            <Ionicons name="car" size={14} color={Colors.accent} />
            <Text style={styles.vehiclePillText}>
              {vehicle.make} {vehicle.model} · {vehicle.batteryCapacityKWh} kWh
            </Text>
            <Ionicons name="create-outline" size={13} color={Colors.textMuted} />
          </Pressable>
        )}

        {/* Origin input */}
        <LocationInput
          label="From"
          icon="navigate-circle-outline"
          value={originQuery}
          confirmed={origin.lat != null}
          loading={geocodingOrigin}
          suggestions={originSuggestions}
          onChangeText={searchOrigin}
          onSelect={selectOrigin}
          onClear={clearOrigin}
        />

        {/* Destination input */}
        <LocationInput
          label="To"
          icon="location"
          value={destinationQuery}
          confirmed={destination.lat != null}
          loading={geocodingDestination}
          suggestions={destinationSuggestions}
          onChangeText={searchDestination}
          onSelect={selectDestination}
          onClear={clearDest}
        />

        {/* Battery slider */}
        <BatterySlider value={currentSoc} onChange={setCurrentSoc} />

        {/* Plan button */}
        <Pressable
          style={[styles.planBtn, !canPlan && styles.planBtnDisabled]}
          onPress={() => {
            Keyboard.dismiss();
            planTrip();
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 400);
          }}
          disabled={!canPlan}
        >
          {status === "planning" ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <Ionicons name="map-outline" size={18} color={Colors.textInverse} />
              <Text style={styles.planBtnText}>Plan my trip</Text>
            </>
          )}
        </Pressable>

        {/* Error */}
        {status === "error" && errorMsg && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Results */}
        {status === "done" && result && (
          <>
            <ResultBanner
              arrivalSoc={result.arrivalSocPercent}
              needsStop={result.needsChargingStop}
              distanceKm={result.route.distanceKm}
              durationMinutes={result.route.durationMinutes}
              energyKwh={result.energyEstimate.energyNeededKwh}
              vehicleName={result.vehicleName ?? "Your vehicle"}
            />

            {showStops && (
              <>
                <View style={styles.stopsHeader}>
                  <Ionicons name="flash" size={16} color={Colors.accent} />
                  <Text style={styles.stopsTitle}>
                    {result.needsChargingStop
                      ? "Charging stops you'll need"
                      : "Charging stops along the way"}
                  </Text>
                </View>
                <Text style={styles.stopsSubtitle}>
                  Ranked by detour distance, charger speed, and price.
                  VehicleGrid stops can be booked directly.
                </Text>
                {result.recommendedStops.map((stop, i) => (
                  <StopCard key={stop.chargerId} stop={stop} index={i} />
                ))}
              </>
            )}

            {status === "done" && result.recommendedStops.length === 0 && (
              <View style={styles.noStopsCard}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <Text style={styles.noStopsText}>
                  No charging stops needed — and no chargers found along this route.
                </Text>
              </View>
            )}

            {/* Reset */}
            <Pressable style={styles.resetBtn} onPress={reset}>
              <Ionicons name="refresh-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.resetText}>Plan a different trip</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.screenPadding, paddingBottom: Spacing.xxxxl },

  pageTitle: { ...Typography.pageTitle, marginBottom: Spacing.xs },
  pageSubtitle: { ...Typography.body, marginBottom: Spacing.xxl },

  // No vehicle
  noVehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  noVehicleTitle: { ...Typography.cardTitle, color: Colors.textPrimary },
  noVehicleBody: { ...Typography.caption, marginTop: 2 },

  // Vehicle pill
  vehiclePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    marginBottom: Spacing.xl,
  },
  vehiclePillText: { ...Typography.caption, color: Colors.accentDark, fontWeight: "600" },

  // Location inputs
  locationBlock: { marginBottom: Spacing.xl, zIndex: 10 },
  fieldLabel: { ...Typography.label, marginBottom: Spacing.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: "visible",
  },
  inputRowConfirmed: { borderColor: Colors.accent },
  inputIcon: { paddingLeft: Spacing.md },
  locationInput: {
    ...Typography.cardTitle,
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  inputRight: { paddingRight: Spacing.md },

  // Suggestions
  suggestionBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    marginTop: Spacing.xs,
    ...Shadows.card,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  suggestionPrimary: { ...Typography.cardTitle, fontSize: 13 },
  suggestionSecondary: { ...Typography.caption, marginTop: 2 },

  // Plan button
  planBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.input,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  planBtnDisabled: { backgroundColor: Colors.textMuted },
  planBtnText: { ...Typography.cardTitle, color: Colors.textInverse, fontSize: 16, fontWeight: "700" },

  // Error
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.error,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  errorText: { ...Typography.body, color: Colors.error, flex: 1 },

  // Result banner
  resultBanner: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    borderWidth: 1.5,
    overflow: "hidden",
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  resultHeadline: { ...Typography.sectionTitle, fontSize: 16 },
  resultStats: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    flexWrap: "wrap",
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
  },
  statPillLabel: { ...Typography.caption, color: Colors.textSecondary },
  resultSub: {
    ...Typography.body,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  resultVehicle: {
    ...Typography.caption,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    color: Colors.textMuted,
  },

  // Stops section
  stopsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  stopsTitle: { ...Typography.sectionTitle, fontSize: 17 },
  stopsSubtitle: { ...Typography.caption, marginBottom: Spacing.lg, lineHeight: 17 },

  // Stop card
  stopCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  stopHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stopIndexBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  stopIndexText: { ...Typography.caption, color: Colors.accentDark, fontWeight: "700" },
  stopFraction: { ...Typography.caption, flex: 1 },
  vgBadge: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  vgBadgeText: { ...Typography.caption, color: Colors.textInverse, fontWeight: "700" },

  stopName: { ...Typography.cardTitle, marginBottom: 2 },
  stopAddress: { ...Typography.caption, marginBottom: Spacing.md },

  stopStatsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  stopStat: { flex: 1, alignItems: "center", gap: 2 },
  stopStatValue: { ...Typography.caption, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  stopStatLabel: { ...Typography.caption, fontSize: 10, textAlign: "center" },

  stopMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  stopConnectors: { ...Typography.caption, color: Colors.textSecondary },
  stopDetour: { ...Typography.caption, color: Colors.textMuted },

  stopFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  stopPrice: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  bookBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
  },
  bookBtnText: { ...Typography.caption, color: Colors.textInverse, fontWeight: "700" },

  // No stops
  noStopsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  noStopsText: { ...Typography.body, flex: 1 },

  // Reset
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  resetText: { ...Typography.caption, color: Colors.textMuted },
});
