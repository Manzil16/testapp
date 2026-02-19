import { View, StyleSheet, Button, Text, TouchableOpacity } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useChargerStore } from "../../src/store/useChargerStore";
import { Charger } from "../../src/models/Charger";

export default function MapsScreen() {
  const router = useRouter();

  const chargers = useChargerStore((state) => state.chargers);
  const seedIfEmpty = useChargerStore((state) => state.seedIfEmpty);
  const confirmWorking = useChargerStore((state) => state.confirmWorking);
  const reportBroken = useChargerStore((state) => state.reportBroken);

  const [selected, setSelected] = useState<Charger | null>(null);

  useEffect(() => {
    seedIfEmpty();
  }, []);

  const getPinColor = (charger: Charger) => {
    if (charger.status === "flagged") return "gray";
    if (charger.status === "verified") return "green";
    return "orange"; // community
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -33.8688,
          longitude: 151.2093,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {chargers.map((charger: Charger) => (
          <Marker
            key={charger.id}
            coordinate={{
              latitude: charger.latitude,
              longitude: charger.longitude,
            }}
            title={charger.name}
            description={`${charger.powerKw} kW • ${charger.connectorType}`}
            pinColor={getPinColor(charger)}
            onPress={() => setSelected(charger)}
          />
        ))}
      </MapView>

      {/* Bottom Info Card */}
      {selected && (
        <View style={styles.card}>
          <Text style={styles.title}>{selected.name}</Text>
          <Text style={styles.subtitle}>{selected.address}</Text>
          <Text style={styles.meta}>
            {selected.powerKw} kW • {selected.connectorType}
          </Text>
          <Text style={styles.meta}>
            Reliability: {selected.verificationScore}%
          </Text>
          <Text style={styles.meta}>
            Status: {selected.status.toUpperCase()}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => confirmWorking(selected.id)}
            >
              <Text style={styles.actionText}>Confirm Working</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => reportBroken(selected.id)}
            >
              <Text style={styles.actionText}>Report Broken</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.button}>
        <Button
          title="Add Charger"
          onPress={() => router.push("/(tabs)/add-charger")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  map: { flex: 1 },

  button: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
  },

  card: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    elevation: 5,
  },

  title: {
    fontSize: 16,
    fontWeight: "bold",
  },

  subtitle: {
    fontSize: 14,
    marginBottom: 6,
  },

  meta: {
    fontSize: 13,
    marginBottom: 4,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  confirmBtn: {
    backgroundColor: "green",
    padding: 8,
    borderRadius: 6,
  },

  reportBtn: {
    backgroundColor: "red",
    padding: 8,
    borderRadius: 6,
  },

  actionText: {
    color: "white",
    fontSize: 12,
  },
});
