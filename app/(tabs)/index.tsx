import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MOCK_CHARGERS } from "../../src/services/chargerService";
import {
  getLastTripCalculation,
  type TripCalculationSnapshot,
} from "../../src/services/energyService";
import { ChargerType } from "../../src/types/enums";
import { APP_COLORS, DEFAULT_VEHICLE } from "../../src/utils/constants";

export default function HomeScreen() {
  const [lastCalculation, setLastCalculation] =
    useState<TripCalculationSnapshot | null>(getLastTripCalculation());

  const chargerSummary = useMemo(() => {
    const fastChargerCount = MOCK_CHARGERS.filter(
      (charger) => charger.type === ChargerType.FAST
    ).length;
    const highestPower = MOCK_CHARGERS.reduce((maxPower, charger) => {
      return Math.max(maxPower, charger.power);
    }, 0);

    return {
      totalChargers: MOCK_CHARGERS.length,
      fastChargerCount,
      highestPower,
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLastCalculation(getLastTripCalculation());
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EV Trip Planner</Text>
      <Text style={styles.subtitle}>Clean architecture demo with in-memory state</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Network Summary</Text>
        <Text>Total chargers: {chargerSummary.totalChargers}</Text>
        <Text>Fast chargers: {chargerSummary.fastChargerCount}</Text>
        <Text>Max charger power: {chargerSummary.highestPower} kW</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Vehicle Info</Text>
        <Text>{DEFAULT_VEHICLE.name}</Text>
        <Text>Battery: {DEFAULT_VEHICLE.batteryCapacityKWh} kWh</Text>
        <Text>
          Efficiency: {DEFAULT_VEHICLE.efficiencyKWhPer100Km} kWh/100km
        </Text>
        <Text>Default reserve: {DEFAULT_VEHICLE.defaultReservePercent}%</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Last Calculation</Text>
        {lastCalculation ? (
          <>
            <Text>
              Energy required: {lastCalculation.result.energyRequired.toFixed(2)} kWh
            </Text>
            <Text>
              Arrival battery: {lastCalculation.result.arrivalBattery.toFixed(2)}%
            </Text>
            <Text>
              Charging required: {lastCalculation.result.needsCharging ? "Yes" : "No"}
            </Text>
          </>
        ) : (
          <Text>No calculation yet. Run one in Trip Planner.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: APP_COLORS.background,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: APP_COLORS.primary,
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 18,
    color: APP_COLORS.mutedText,
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: APP_COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 3,
  },
  sectionTitle: {
    fontWeight: "700",
    color: APP_COLORS.text,
    marginBottom: 6,
  },
});
