import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Button,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { searchAddress, GeoResult } from "../../src/services/geocodingService";
import { getRouteDistanceKm } from "../../src/services/routingService";
import { useChargerStore } from "../../src/store/useChargerStore";
import { useRouter } from "expo-router";

export default function TripScreen() {
  const router = useRouter();
  const chargers = useChargerStore((state) => state.chargers);

  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [fromResults, setFromResults] = useState<GeoResult[]>([]);
  const [toResults, setToResults] = useState<GeoResult[]>([]);
  const [fromLocation, setFromLocation] = useState<GeoResult | null>(null);
  const [toLocation, setToLocation] = useState<GeoResult | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [arrivalPercent, setArrivalPercent] = useState<number | null>(null);
  const [recommendedCharger, setRecommendedCharger] = useState<any>(null);
  const [backupCharger, setBackupCharger] = useState<any>(null);

  const batteryCapacityKwh = 60;
  const efficiencyKwhPer100Km = 18;
  const currentBatteryPercent = 60;
  const safetyBufferPercent = 10;

  const handleSearchFrom = async (text: string) => {
    setFromQuery(text);
    const results = await searchAddress(text);
    setFromResults(results);
  };

  const handleSearchTo = async (text: string) => {
    setToQuery(text);
    const results = await searchAddress(text);
    setToResults(results);
  };

  const calculateTrip = async () => {
    if (!fromLocation || !toLocation) {
      Alert.alert("Please select both locations");
      return;
    }

    const distance = await getRouteDistanceKm(
      fromLocation.latitude,
      fromLocation.longitude,
      toLocation.latitude,
      toLocation.longitude
    );

    if (!distance || distance <= 0) {
      Alert.alert("Could not calculate route");
      return;
    }

    setDistanceKm(distance);

    const uncertaintyFactor = 1.08;
    const terrainFactor = 1.05;

    const effectiveEfficiency =
      efficiencyKwhPer100Km * uncertaintyFactor * terrainFactor;

    const energyNeeded = (distance * effectiveEfficiency) / 100;

    const availableEnergy =
      (batteryCapacityKwh * currentBatteryPercent) / 100;

    const remainingEnergy = availableEnergy - energyNeeded;

    const arrival =
      (remainingEnergy / batteryCapacityKwh) * 100;

    setArrivalPercent(arrival);

    if (arrival > safetyBufferPercent) {
      setRecommendedCharger(null);
      setBackupCharger(null);
      return;
    }

    const trustedChargers = chargers
      .filter(
        (c) =>
          c.status !== "flagged" &&
          c.verificationScore > 30
      )
      .sort((a, b) => b.powerKw - a.powerKw);

    if (trustedChargers.length === 0) {
      setRecommendedCharger(null);
      return;
    }

    setRecommendedCharger(trustedChargers[0]);
    setBackupCharger(trustedChargers[1] || null);
  };

  const renderResult = () => {
    if (distanceKm === null || arrivalPercent === null) return null;

    const lower = arrivalPercent - 4;
    const upper = arrivalPercent + 4;

    const directSafe = arrivalPercent > safetyBufferPercent;

    return (
      <View style={styles.resultBox}>
        <Text style={styles.resultTitle}>Trip Summary</Text>

        <Text>Distance: {distanceKm.toFixed(1)} km</Text>
        <Text>
          Estimated arrival: {lower.toFixed(0)}% –{" "}
          {upper.toFixed(0)}%
        </Text>

        {!directSafe && recommendedCharger && (
          <>
            <Text style={styles.sectionTitle}>
              Recommended Stop
            </Text>
            <Text>{recommendedCharger.name}</Text>
            <Text>{recommendedCharger.powerKw} kW</Text>

            {backupCharger && (
              <>
                <Text style={styles.sectionTitle}>
                  Backup Option
                </Text>
                <Text>{backupCharger.name}</Text>
              </>
            )}
          </>
        )}

        <View style={{ marginTop: 15 }}>
          {!directSafe && recommendedCharger && (
            <Button
              title="Start Trip (Recommended)"
              onPress={() =>
                router.push("/trip-plan" as any)
              }
            />
          )}

          <View style={{ height: 10 }} />

          <Button
            title="Start Trip (Direct)"
            disabled={!directSafe}
            onPress={() =>
              router.push("/trip-plan" as any)
            }
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plan Your Trip</Text>

      <TextInput
        placeholder="From"
        style={styles.input}
        value={fromQuery}
        onChangeText={handleSearchFrom}
      />

      <FlatList
        data={fromResults}
        keyExtractor={(item) => item.displayName}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              setFromLocation(item);
              setFromResults([]);
              setFromQuery(item.displayName);
            }}
          >
            <Text style={styles.resultItem}>
              {item.displayName}
            </Text>
          </TouchableOpacity>
        )}
      />

      <TextInput
        placeholder="To"
        style={styles.input}
        value={toQuery}
        onChangeText={handleSearchTo}
      />

      <FlatList
        data={toResults}
        keyExtractor={(item) => item.displayName}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              setToLocation(item);
              setToResults([]);
              setToQuery(item.displayName);
            }}
          >
            <Text style={styles.resultItem}>
              {item.displayName}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Button title="Calculate Trip" onPress={calculateTrip} />

      {renderResult()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
  },
  resultItem: {
    padding: 8,
    backgroundColor: "#eee",
    marginBottom: 5,
  },
  resultBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  resultTitle: {
    fontWeight: "bold",
    marginBottom: 10,
  },
  sectionTitle: {
    marginTop: 10,
    fontWeight: "bold",
  },
});
