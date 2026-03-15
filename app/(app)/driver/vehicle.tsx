import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  EmptyStateCard,
  InputField,
  PrimaryCTA,
  ScreenContainer,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { useVehicleProfile } from "@/src/hooks";

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function VehicleProfileScreen() {
  const { authUser, sessionUser } = useAuth();
  const userId = useMemo(
    () => authUser?.uid || sessionUser?.uid,
    [authUser?.uid, sessionUser?.uid]
  );

  const { data, isLoading, error, refresh, saveVehicle } = useVehicleProfile(userId);

  const [make, setMake] = useState("Tesla");
  const [model, setModel] = useState("Model Y");
  const [year, setYear] = useState("2024");
  const [batteryCapacityKWh, setBatteryCapacityKWh] = useState("75");
  const [maxRangeKm, setMaxRangeKm] = useState("505");
  const [efficiencyWhKm, setEfficiencyWhKm] = useState("155");
  const [reservePercent, setReservePercent] = useState("12");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const vehicle = data.primaryVehicle;
    if (!vehicle) {
      return;
    }

    setMake(vehicle.make);
    setModel(vehicle.model);
    setYear(String(vehicle.year));
    setBatteryCapacityKWh(String(vehicle.batteryCapacityKWh));
    setMaxRangeKm(String(vehicle.maxRangeKm));
    setEfficiencyWhKm(String(Math.round(vehicle.efficiencyKWhPer100Km * 10)));
    setReservePercent(String(vehicle.defaultReservePercent));
  }, [data.primaryVehicle]);

  const save = async () => {
    if (!userId) {
      Alert.alert("Vehicle", "You must be signed in.");
      return;
    }

    try {
      setSaving(true);
      await saveVehicle(
        {
          name: `${make} ${model}`.trim(),
          make: make.trim() || "Unknown",
          model: model.trim() || "Unknown",
          year: Math.max(2010, toNumber(year, 2024)),
          batteryCapacityKWh: Math.max(20, toNumber(batteryCapacityKWh, 60)),
          maxRangeKm: Math.max(120, toNumber(maxRangeKm, 350)),
          efficiencyKWhPer100Km: Math.max(8, toNumber(efficiencyWhKm, 155) / 10),
          defaultReservePercent: Math.max(5, Math.min(40, toNumber(reservePercent, 12))),
        },
        data.primaryVehicle?.id
      );
      Alert.alert("Vehicle saved", "Vehicle profile updated.");
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer>
        <Animated.View entering={FadeIn.duration(240)}>
          <Text style={Typography.pageTitle}>Vehicle Profile</Text>
          <Text style={Typography.body}>Used in trip planning and battery predictions.</Text>
        </Animated.View>

        {error ? (
          <EmptyStateCard
            icon="⚠️"
            title="Could not load vehicle"
            message={error}
            actionLabel="Retry"
            onAction={refresh}
          />
        ) : null}

        <Animated.View entering={FadeInDown.duration(260)} style={styles.card}>
          <InputField label="Make" value={make} onChangeText={setMake} />
          <InputField label="Model" value={model} onChangeText={setModel} />
          <InputField label="Year" value={year} onChangeText={setYear} keyboardType="numeric" />
          <InputField
            label="Battery Capacity (kWh)"
            value={batteryCapacityKWh}
            onChangeText={setBatteryCapacityKWh}
            keyboardType="numeric"
          />
          <InputField
            label="Range (km)"
            value={maxRangeKm}
            onChangeText={setMaxRangeKm}
            keyboardType="numeric"
          />
          <InputField
            label="Efficiency (Wh/km)"
            value={efficiencyWhKm}
            onChangeText={setEfficiencyWhKm}
            keyboardType="numeric"
          />
          <InputField
            label="Reserve %"
            value={reservePercent}
            onChangeText={setReservePercent}
            keyboardType="numeric"
          />

          <PrimaryCTA
            label={isLoading ? "Loading..." : "Save Vehicle"}
            onPress={save}
            loading={saving}
          />
        </Animated.View>
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  card: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    ...Shadows.card,
  },
});
