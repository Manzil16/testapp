import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from "react-native";
import Slider from "@react-native-community/slider";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function SettingsScreen() {
  const [reservePercent, setReservePercent] = useState(10);
  const [efficiency, setEfficiency] = useState(18);
  const [darkMode, setDarkMode] = useState(false);

  const palette = {
    background: darkMode ? "#111827" : "#F5F7FA",
    card: darkMode ? "#1F2937" : "#FFFFFF",
    text: darkMode ? "#F9FAFB" : "#111827",
  };

  const saveSettings = () => {
    Alert.alert("Settings Saved");
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>
        Settings
      </Text>

      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="battery" size={22} color="#0E7A56" />
          <Text style={{ color: palette.text }}>
            Safety Reserve: {reservePercent}%
          </Text>
        </View>

        <Slider
          minimumValue={5}
          maximumValue={30}
          value={reservePercent}
          onValueChange={setReservePercent}
        />
      </View>

      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="flash" size={22} color="#0E7A56" />
          <Text style={{ color: palette.text }}>
            Efficiency: {efficiency} kWh/100km
          </Text>
        </View>

        <Slider
          minimumValue={12}
          maximumValue={25}
          value={efficiency}
          onValueChange={setEfficiency}
        />
      </View>

      <View style={[styles.card, styles.row, { backgroundColor: palette.card }]}>
        <Text style={{ color: palette.text }}>Dark Mode</Text>
        <Switch value={darkMode} onValueChange={setDarkMode} />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
        <Text style={styles.saveText}>Save Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 20,
  },
  card: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: "#0E7A56",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  saveText: {
    color: "white",
    fontWeight: "700",
  },
});