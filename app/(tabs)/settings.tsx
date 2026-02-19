import { useMemo, useState } from "react";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { ThemeMode } from "../../src/types/enums";
import {
  DEFAULT_EFFICIENCY_KWH_PER_100KM,
  DEFAULT_RESERVE_PERCENT,
} from "../../src/utils/constants";

interface ThemePalette {
  background: string;
  card: string;
  text: string;
  subtitle: string;
  title: string;
}

export default function SettingsScreen() {
  const [defaultReservePercent, setDefaultReservePercent] = useState(
    String(DEFAULT_RESERVE_PERCENT)
  );
  const [defaultEfficiency, setDefaultEfficiency] = useState(
    String(DEFAULT_EFFICIENCY_KWH_PER_100KM)
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(ThemeMode.LIGHT);

  const isDark = themeMode === ThemeMode.DARK;

  const palette = useMemo<ThemePalette>(() => {
    if (isDark) {
      return {
        background: "#111827",
        card: "#1F2937",
        text: "#F9FAFB",
        subtitle: "#D1D5DB",
        title: "#A7F3D0",
      };
    }

    return {
      background: "#F3F5F7",
      card: "#FFFFFF",
      text: "#111827",
      subtitle: "#6B7280",
      title: "#0E7A56",
    };
  }, [isDark]);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.title }]}>Settings</Text>

      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <Text style={[styles.label, { color: palette.text }]}>Default Safety Reserve (%)</Text>
        <TextInput
          value={defaultReservePercent}
          onChangeText={setDefaultReservePercent}
          keyboardType="numeric"
          style={[styles.input, { color: palette.text, borderColor: palette.subtitle }]}
        />
      </View>

      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <Text style={[styles.label, { color: palette.text }]}>Default Efficiency (kWh/100km)</Text>
        <TextInput
          value={defaultEfficiency}
          onChangeText={setDefaultEfficiency}
          keyboardType="numeric"
          style={[styles.input, { color: palette.text, borderColor: palette.subtitle }]}
        />
      </View>

      <View style={[styles.card, styles.row, { backgroundColor: palette.card }]}>
        <Text style={[styles.label, { color: palette.text }]}>Theme ({themeMode})</Text>
        <Switch
          value={isDark}
          onValueChange={(enabled) =>
            setThemeMode(enabled ? ThemeMode.DARK : ThemeMode.LIGHT)
          }
        />
      </View>

      <Text style={[styles.helperText, { color: palette.subtitle }]}>These settings are local state only.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 18,
  },
  card: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
  },
});
