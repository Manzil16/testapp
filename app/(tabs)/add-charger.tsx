import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Button,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useChargerStore } from "../../src/store/useChargerStore";

export default function AddChargerScreen() {
  const router = useRouter();

  const addCommunityCharger = useChargerStore(
    (state) => state.addCommunityCharger
  );

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [powerKw, setPowerKw] = useState("");

  const handleAdd = () => {
    if (!name || !address || !latitude || !longitude || !powerKw) {
      Alert.alert("Please fill all fields");
      return;
    }

    addCommunityCharger({
      name,
      address,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      powerKw: parseFloat(powerKw),
      connectorType: "CCS2",
      availability: {
        from: "08:00",
        to: "22:00",
      },
    });

    Alert.alert("Charger added as Community listing");
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Community Charger</Text>

      <TextInput
        placeholder="Charger Name"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Address"
        style={styles.input}
        value={address}
        onChangeText={setAddress}
      />

      <TextInput
        placeholder="Latitude"
        style={styles.input}
        value={latitude}
        onChangeText={setLatitude}
        keyboardType="numeric"
      />

      <TextInput
        placeholder="Longitude"
        style={styles.input}
        value={longitude}
        onChangeText={setLongitude}
        keyboardType="numeric"
      />

      <TextInput
        placeholder="Power (kW)"
        style={styles.input}
        value={powerKw}
        onChangeText={setPowerKw}
        keyboardType="numeric"
      />

      <Button title="Add Charger" onPress={handleAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 15,
    borderRadius: 6,
  },
});
