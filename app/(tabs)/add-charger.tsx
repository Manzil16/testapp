import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useChargerStore } from "../../src/store/useChargerStore";
import * as Location from "expo-location";

export default function AddChargerScreen() {
  const router = useRouter();
  const addCommunityCharger = useChargerStore(
    (state) => state.addCommunityCharger
  );

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [powerKw, setPowerKw] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(false);

  const handleAdd = async () => {
    if (!name || !address || !powerKw) {
      Alert.alert("Fill all required fields");
      return;
    }

    setLoadingLocation(true);

    const { status } =
      await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location permission required");
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    setLoadingLocation(false);

    addCommunityCharger({
      name,
      address,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      powerKw: parseFloat(powerKw),
      connectorType: "CCS2",
      availability: { from: "08:00", to: "22:00" },
    });

    Alert.alert("Community charger added");
    router.back();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add Community Charger</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Charger Name</Text>
        <TextInput
          placeholder="Sydney Fast Hub"
          style={styles.input}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          placeholder="123 George Street, Sydney"
          style={styles.input}
          value={address}
          onChangeText={setAddress}
        />

        <Text style={styles.label}>Power (kW)</Text>
        <TextInput
          placeholder="150"
          keyboardType="numeric"
          style={styles.input}
          value={powerKw}
          onChangeText={setPowerKw}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleAdd}>
        <Text style={styles.buttonText}>
          {loadingLocation ? "Fetching location..." : "Add Charger"}
        </Text>
      </TouchableOpacity>
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
    fontWeight: "700",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 12,
  },
  button: {
    marginTop: 30,
    backgroundColor: "#0E7A56",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});