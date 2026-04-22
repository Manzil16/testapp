import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  EmptyStateCard,
  GradientButton,
  InfoPill,
  InputField,
  PremiumCard,
  ScreenContainer,
  SectionTitle,
  Typography,
  Colors,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { useVehicleProfile } from "@/src/hooks";
import { AppConfig } from "@/src/constants/app";

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CONNECTOR_DESCRIPTIONS: Record<string, string> = {
  Type2: "Most AC home & public chargers in Australia",
  CCS2: "Combined AC + DC fast charging (most modern EVs)",
  CHAdeMO: "DC fast charging (older Nissan, Mitsubishi)",
  Tesla: "Tesla proprietary connector",
};

function ConnectorOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[connectorStyles.row, selected && connectorStyles.rowSelected]}
      onPress={onPress}
    >
      <View style={[connectorStyles.radio, selected && connectorStyles.radioSelected]}>
        {selected && <View style={connectorStyles.radioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={connectorStyles.label}>{label}</Text>
        <Text style={connectorStyles.desc}>{CONNECTOR_DESCRIPTIONS[label]}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />}
    </Pressable>
  );
}

const connectorStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowSelected: { borderBottomColor: Colors.accentLight },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: Colors.accent },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    fontFamily: "DMSans_600SemiBold",
  },
  desc: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: "DMSans_400Regular",
    marginTop: 1,
  },
});

export default function VehicleProfileScreen() {
  const { user } = useAuth();
  const userId = useMemo(
    () => user?.id,
    [user?.id]
  );

  const { data, isLoading, error, refresh, saveVehicle } = useVehicleProfile(userId);

  const [make, setMake] = useState<string>(AppConfig.VEHICLE_DEFAULTS.make);
  const [model, setModel] = useState<string>(AppConfig.VEHICLE_DEFAULTS.model);
  const [year, setYear] = useState(String(AppConfig.VEHICLE_DEFAULTS.year));
  const [batteryCapacityKWh, setBatteryCapacityKWh] = useState(String(AppConfig.VEHICLE_DEFAULTS.batteryCapacityKwh));
  const [maxRangeKm, setMaxRangeKm] = useState(String(AppConfig.VEHICLE_DEFAULTS.maxRangeKm));
  const [efficiencyWhKm, setEfficiencyWhKm] = useState(String(AppConfig.VEHICLE_DEFAULTS.efficiencyWhKm));
  const [reservePercent, setReservePercent] = useState(String(AppConfig.VEHICLE_DEFAULTS.reservePercent));
  const [connectorType, setConnectorType] = useState("Type2");
  const [maxChargePowerKw, setMaxChargePowerKw] = useState("11");
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
    setConnectorType(vehicle.connectorType || "Type2");
    setMaxChargePowerKw(String(vehicle.maxChargePowerKw || 11));
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
          year: Math.max(AppConfig.VEHICLE_DEFAULTS.bounds.minYear, toNumber(year, AppConfig.VEHICLE_DEFAULTS.year)),
          batteryCapacityKWh: Math.max(AppConfig.VEHICLE_DEFAULTS.bounds.minBatteryKwh, toNumber(batteryCapacityKWh, AppConfig.VEHICLE_DEFAULTS.bounds.fallbackBatteryKwh)),
          maxRangeKm: Math.max(AppConfig.VEHICLE_DEFAULTS.bounds.minRangeKm, toNumber(maxRangeKm, AppConfig.VEHICLE_DEFAULTS.bounds.fallbackRangeKm)),
          efficiencyKWhPer100Km: Math.max(AppConfig.VEHICLE_DEFAULTS.bounds.minEfficiencyKwhPer100, toNumber(efficiencyWhKm, AppConfig.VEHICLE_DEFAULTS.efficiencyWhKm) / 10),
          defaultReservePercent: Math.max(AppConfig.VEHICLE_DEFAULTS.bounds.minReservePercent, Math.min(AppConfig.VEHICLE_DEFAULTS.bounds.maxReservePercent, toNumber(reservePercent, AppConfig.VEHICLE_DEFAULTS.reservePercent))),
          connectorType: connectorType.trim() || "Type2",
          maxChargePowerKw: Math.max(1, toNumber(maxChargePowerKw, 11)),
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

        {data.primaryVehicle && (
          <Animated.View entering={FadeInDown.duration(260)}>
            <PremiumCard style={styles.section}>
              <View style={styles.vehicleSummary}>
                <Text style={styles.vehicleIcon}>🚗</Text>
                <View style={{ flex: 1 }}>
                  <Text style={Typography.cardTitle}>
                    {data.primaryVehicle.make} {data.primaryVehicle.model}
                  </Text>
                  <Text style={Typography.caption}>{data.primaryVehicle.year}</Text>
                </View>
              </View>
              <View style={styles.pillRow}>
                <InfoPill label={`${data.primaryVehicle.batteryCapacityKWh} kWh`} variant="primary" />
                <InfoPill label={`${data.primaryVehicle.maxRangeKm} km range`} variant="success" />
                <InfoPill label={`${data.primaryVehicle.defaultReservePercent}% reserve`} />
                <InfoPill
                  label={data.primaryVehicle.calibrationStatus === "uncalibrated" ? "Not calibrated" : `Calibrated (${data.primaryVehicle.calibrationStatus})`}
                  variant={data.primaryVehicle.calibrationStatus === "uncalibrated" ? "warning" : "success"}
                />
              </View>
            </PremiumCard>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(80).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Vehicle Details" topSpacing={Spacing.xs} />
            <InputField label="Make" value={make} onChangeText={setMake} />
            <InputField label="Model" value={model} onChangeText={setModel} />
            <InputField label="Year" value={year} onChangeText={setYear} keyboardType="numeric" />
          </PremiumCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Battery & Efficiency" topSpacing={Spacing.xs} />
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
              hint="Battery percentage to keep in reserve during trips"
            />
            <InputField
              label="Max charge power (kW)"
              value={maxChargePowerKw}
              onChangeText={setMaxChargePowerKw}
              keyboardType="numeric"
              hint="Your car's maximum AC/DC charge accept rate (e.g. 11 for AC, 50–350 for DC)"
            />
          </PremiumCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Charging Connector" topSpacing={Spacing.xs} />
            {(["Type2", "CCS2", "CHAdeMO", "Tesla"] as const).map((type) => (
              <ConnectorOption
                key={type}
                label={type}
                selected={connectorType === type}
                onPress={() => setConnectorType(type)}
              />
            ))}
          </PremiumCard>
        </Animated.View>

        <GradientButton
          label={isLoading ? "Loading..." : "Save Vehicle"}
          onPress={save}
          loading={saving}
          style={styles.saveBtn}
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
  section: {
    marginBottom: Spacing.md,
  },
  vehicleSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  vehicleIcon: {
    fontSize: 36,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  saveBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
});
