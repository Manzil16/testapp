import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { listenToChargers, Charger } from "../../src/services/firestoreService";

export default function MapsScreen() {
  const router = useRouter();

  const [chargers, setChargers] = useState<Charger[]>([]);
  const [selected, setSelected] = useState<Charger | null>(null);
  const [location, setLocation] =
    useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---------------- FETCH CHARGERS ---------------- */

  useEffect(() => {
    const unsubscribe = listenToChargers((data) => {
      setChargers(data);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /* ---------------- USER LOCATION ---------------- */

  useEffect(() => {
    (async () => {
      const { status } =
        await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading chargers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation
        initialRegion={{
          latitude: location?.coords.latitude || -33.8688,
          longitude: location?.coords.longitude || 151.2093,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {chargers.map((charger) => (
          <Marker
            key={charger.id}
            coordinate={{
              latitude: charger.latitude,
              longitude: charger.longitude,
            }}
            title={charger.name}
            description={`${charger.speedCategory}`}
            onPress={() => setSelected(charger)}
          />
        ))}
      </MapView>

      {/* ---------------- INFO CARD ---------------- */}

      {selected && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{selected.name}</Text>

          <View style={styles.row}>
            <MaterialCommunityIcons
              name="ev-station"
              size={18}
              color="#0E7A56"
            />
            <Text>{selected.networkType}</Text>
          </View>

          {selected.connectors?.map((c, index) => (
            <View key={index} style={styles.row}>
              <MaterialCommunityIcons
                name="flash"
                size={18}
                color="#0E7A56"
              />
              <Text>
                {c.type} — {c.powerKW} kW
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setSelected(null)}
          >
            <Text style={styles.primaryText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ---------------- ADD BUTTON ---------------- */}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(tabs)/add-charger")}
      >
        <MaterialCommunityIcons name="plus" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    elevation: 8,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },

  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#0E7A56",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: {
    color: "white",
    fontWeight: "600",
  },

  fab: {
    position: "absolute",
    bottom: 40,
    right: 20,
    backgroundColor: "#0E7A56",
    padding: 18,
    borderRadius: 30,
    elevation: 8,
  },
});