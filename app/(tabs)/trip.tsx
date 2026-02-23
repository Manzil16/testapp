import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { searchAddress, GeoResult } from "../../src/services/geocodingService";
import { getRouteData } from "../../src/services/routingService";
import { useChargerStore } from "../../src/store/useChargerStore";
import { useTripStore } from "../../src/store/useTripStore";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function TripScreen() {
  const router = useRouter();
  const chargers = useChargerStore((state) => state.chargers);
  const setTripData = useTripStore((state) => state.setTripData);

  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [fromResults, setFromResults] = useState<GeoResult[]>([]);
  const [toResults, setToResults] = useState<GeoResult[]>([]);
  const [fromLocation, setFromLocation] = useState<GeoResult | null>(null);
  const [toLocation, setToLocation] = useState<GeoResult | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [arrivalPercent, setArrivalPercent] = useState<number | null>(null);
  const [recommendedCharger, setRecommendedCharger] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const batteryCapacityKwh = 60;
  const efficiencyKwhPer100Km = 18;
  const currentBatteryPercent = 60;
  const safetyBufferPercent = 10;

  const swapLocations = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
    setFromQuery(toQuery);
    setToQuery(fromQuery);
  };

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
      Alert.alert("Select both locations");
      return;
    }

    setLoading(true);

    const route = await getRouteData(
      fromLocation.latitude,
      fromLocation.longitude,
      toLocation.latitude,
      toLocation.longitude
    );

    if (!route) {
      setLoading(false);
      Alert.alert("Route failed");
      return;
    }

    setDistanceKm(route.distanceKm);

    const energyNeeded =
      (route.distanceKm * efficiencyKwhPer100Km) / 100;

    const availableEnergy =
      (batteryCapacityKwh * currentBatteryPercent) / 100;

    const remainingEnergy = availableEnergy - energyNeeded;
    const arrival =
      (remainingEnergy / batteryCapacityKwh) * 100;

    setArrivalPercent(arrival);

    let selectedCharger = null;

    if (arrival <= safetyBufferPercent) {
      selectedCharger = chargers
        .filter((c) => c.status !== "flagged")
        .sort((a, b) => b.powerKw - a.powerKw)[0];
    }

    setRecommendedCharger(selectedCharger);

    setTripData({
      origin: {
    name: fromLocation.displayName,
    latitude: fromLocation.latitude,
    longitude: fromLocation.longitude,
  },
  destination: {
    name: toLocation.displayName,
    latitude: toLocation.latitude,
    longitude: toLocation.longitude,
  },
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      polyline: route.polyline,
      predictedArrivalPercent: arrival,
      recommendedCharger: selectedCharger,
      tripActive: true,
    });

    setLoading(false);
  };

  const getArrivalColor = () => {
    if (!arrivalPercent) return "#000";
    if (arrivalPercent > 20) return "#0E7A56";
    if (arrivalPercent > 10) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Plan Your Trip</Text>

      {/* FROM */}
      <View style={styles.card}>
        <Text style={styles.label}>From</Text>
        <TextInput
          placeholder="Start location"
          style={styles.input}
          value={fromQuery}
          onChangeText={handleSearchFrom}
        />

        <FlatList
          data={fromResults}
          keyExtractor={(item, i) => item.displayName + i}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultItem}
              onPress={() => {
                setFromLocation(item);
                setFromResults([]);
                setFromQuery(item.displayName);
              }}
            >
              <Text>{item.displayName}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Swap Button */}
      <TouchableOpacity style={styles.swapBtn} onPress={swapLocations}>
        <MaterialCommunityIcons
          name="swap-vertical"
          size={22}
          color="white"
        />
      </TouchableOpacity>

      {/* TO */}
      <View style={styles.card}>
        <Text style={styles.label}>To</Text>
        <TextInput
          placeholder="Destination"
          style={styles.input}
          value={toQuery}
          onChangeText={handleSearchTo}
        />

        <FlatList
          data={toResults}
          keyExtractor={(item, i) => item.displayName + i}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultItem}
              onPress={() => {
                setToLocation(item);
                setToResults([]);
                setToQuery(item.displayName);
              }}
            >
              <Text>{item.displayName}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={calculateTrip}
        >
          <Text style={styles.primaryText}>Calculate Trip</Text>
        </TouchableOpacity>
      )}

      {distanceKm && arrivalPercent !== null && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Trip Summary</Text>
          <Text>Distance: {distanceKm.toFixed(1)} km</Text>
          <Text style={{ color: getArrivalColor(), fontWeight: "700" }}>
            Arrival Battery: {arrivalPercent.toFixed(1)}%
          </Text>

          {recommendedCharger && (
            <>
              <Text style={styles.sectionTitle}>
                Recommended Charger
              </Text>
              <Text>{recommendedCharger.name}</Text>
              <Text>{recommendedCharger.powerKw} kW</Text>
            </>
          )}

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/trip-plan" as any)}
          >
            <Text style={styles.secondaryText}>Start Navigation</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    elevation: 6,
    marginBottom: 12,
  },
  label: {
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F3F4F6",
    padding: 14,
    borderRadius: 12,
  },
  resultItem: {
    padding: 10,
    borderBottomWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  swapBtn: {
    alignSelf: "center",
    backgroundColor: "#0E7A56",
    padding: 10,
    borderRadius: 30,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: "#0E7A56",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
  },
  primaryText: {
    color: "white",
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 20,
    marginTop: 20,
    elevation: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  sectionTitle: {
    marginTop: 10,
    fontWeight: "700",
  },
  secondaryBtn: {
    marginTop: 15,
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryText: {
    color: "white",
    fontWeight: "600",
  },
});