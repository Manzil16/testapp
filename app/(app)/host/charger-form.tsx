import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  EmptyStateCard,
  FilterChip,
  InputField,
  PrimaryCTA,
  ScreenContainer,
  SectionTitle,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { type AvailabilityDay, type ConnectorType } from "@/src/features/chargers";
import { useHostChargers } from "@/src/hooks";

const connectorOptions: ConnectorType[] = ["Type2", "CCS2", "CHAdeMO", "Tesla"];
const amenityOptions = ["WiFi", "Parking", "Restroom", "Cafe", "CCTV", "Lighting"];
const weekdays: AvailabilityDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function HostChargerFormScreen() {
  const router = useRouter();
  const { chargerId } = useLocalSearchParams<{ chargerId?: string }>();
  const { authUser, sessionUser } = useAuth();

  const userId = useMemo(
    () => authUser?.uid || sessionUser?.uid,
    [authUser?.uid, sessionUser?.uid]
  );

  const { error, actions } = useHostChargers(userId);

  const [loading, setLoading] = useState(Boolean(chargerId));
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [stateCode, setStateCode] = useState("NSW");

  const [latitude, setLatitude] = useState(-33.8688);
  const [longitude, setLongitude] = useState(151.2093);

  const [powerKw, setPowerKw] = useState("22");
  const [pricePerKwh, setPricePerKwh] = useState("0.55");
  const [selectedConnectors, setSelectedConnectors] = useState<ConnectorType[]>(["Type2"]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const [availabilityDays, setAvailabilityDays] = useState<Record<AvailabilityDay, boolean>>(
    Object.fromEntries(weekdays.map((day) => [day, true])) as Record<AvailabilityDay, boolean>
  );
  const [fromTime, setFromTime] = useState("06:00");
  const [toTime, setToTime] = useState("22:00");

  useEffect(() => {
    if (!chargerId) {
      setLoading(false);
      return;
    }

    actions
      .loadCharger(chargerId)
      .then((charger) => {
        if (!charger) {
          return;
        }

        setName(charger.name);
        setDescription(charger.availabilityNote || "");
        setAddress(charger.address);
        setSuburb(charger.suburb);
        setStateCode(charger.state);
        setLatitude(charger.latitude);
        setLongitude(charger.longitude);
        setPowerKw(String(charger.maxPowerKw));
        setPricePerKwh(String(charger.pricingPerKwh));
        setSelectedConnectors(charger.connectors.map((item) => item.type));
        setSelectedAmenities(charger.amenities);
        if (charger.availabilityWindow) {
          const availableDays = new Set(charger.availabilityWindow.days);
          setAvailabilityDays(
            Object.fromEntries(
              weekdays.map((day) => [day, availableDays.has(day)])
            ) as Record<AvailabilityDay, boolean>
          );
          setFromTime(charger.availabilityWindow.startTime);
          setToTime(charger.availabilityWindow.endTime);
        }
      })
      .finally(() => setLoading(false));
  }, [actions, chargerId]);

  const toggleConnector = (connector: ConnectorType) => {
    setSelectedConnectors((current) =>
      current.includes(connector)
        ? current.filter((item) => item !== connector)
        : [...current, connector]
    );
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity]
    );
  };

  const toggleDay = (day: AvailabilityDay) => {
    setAvailabilityDays((current) => ({ ...current, [day]: !current[day] }));
  };

  const save = async () => {
    if (!userId) {
      Alert.alert("Host", "You must be signed in.");
      return;
    }

    if (!name.trim() || !address.trim() || !suburb.trim()) {
      Alert.alert("Host", "Name, address, and suburb are required.");
      return;
    }

    if (!selectedConnectors.length) {
      Alert.alert("Host", "Select at least one connector.");
      return;
    }

    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(fromTime) || !timePattern.test(toTime)) {
      Alert.alert("Host", "Availability times must use 24h HH:mm format.");
      return;
    }

    const activeDays = weekdays.filter((day) => availabilityDays[day]);
    if (!activeDays.length) {
      Alert.alert("Host", "Select at least one available day.");
      return;
    }

    try {
      setSaving(true);
      const availabilityNote = `${activeDays.join(", ")} ${fromTime}-${toTime}${
        description.trim() ? ` • ${description.trim()}` : ""
      }`;

      await actions.saveCharger({
        chargerId,
        payload: {
          name: name.trim(),
          address: address.trim(),
          suburb: suburb.trim(),
          state: stateCode.trim().toUpperCase(),
          latitude,
          longitude,
          maxPowerKw: Math.max(7, parseNumber(powerKw, 22)),
          pricingPerKwh: Math.max(0.2, parseNumber(pricePerKwh, 0.55)),
          connectors: selectedConnectors.map((type) => ({
            type,
            powerKw: Math.max(7, parseNumber(powerKw, 22)),
            count: 1,
          })),
          amenities: selectedAmenities,
          availabilityNote,
          availabilityWindow: {
            days: activeDays,
            startTime: fromTime,
            endTime: toTime,
          },
        },
      });

      Alert.alert("Saved", chargerId ? "Charger updated." : "Charger submitted for verification.");
      router.back();
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScreenContainer>
          <EmptyStateCard icon="⏳" title="Loading charger" message="Preparing form..." />
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer>
        <Animated.View entering={FadeIn.duration(220)}>
          <Text style={Typography.pageTitle}>{chargerId ? "Edit Charger" : "Add Charger"}</Text>
          <Text style={Typography.body}>Create a high-quality listing for your charger.</Text>
        </Animated.View>

        {error ? <EmptyStateCard icon="⚠️" title="Form error" message={error} /> : null}

        <Animated.View entering={FadeInDown.duration(260)} style={styles.card}>
          <SectionTitle title="Basic Info" topSpacing={Spacing.xs} />
          <InputField label="Name" value={name} onChangeText={setName} />
          <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={3} />

          <SectionTitle title="Location" />
          <InputField label="Address" value={address} onChangeText={setAddress} />
          <InputField label="Suburb" value={suburb} onChangeText={setSuburb} />
          <InputField label="State" value={stateCode} onChangeText={setStateCode} />

          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude,
                longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              onPress={(event) => {
                setLatitude(event.nativeEvent.coordinate.latitude);
                setLongitude(event.nativeEvent.coordinate.longitude);
              }}
            >
              <Marker coordinate={{ latitude, longitude }} />
            </MapView>
          </View>
          <Text style={styles.coordText}>
            Pin: {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>

          <SectionTitle title="Specs" />
          <InputField
            label="Power (kW)"
            value={powerKw}
            onChangeText={setPowerKw}
            keyboardType="numeric"
          />
          <InputField
            label="Price per kWh"
            value={pricePerKwh}
            onChangeText={setPricePerKwh}
            keyboardType="numeric"
          />
          <Text style={styles.inlineLabel}>Connector Types</Text>
          <View style={styles.chipWrap}>
            {connectorOptions.map((option) => (
              <FilterChip
                key={option}
                label={option}
                active={selectedConnectors.includes(option)}
                onPress={() => toggleConnector(option)}
              />
            ))}
          </View>

          <SectionTitle title="Availability" />
          <Text style={styles.inlineLabel}>Days</Text>
          <View style={styles.chipWrap}>
            {weekdays.map((day) => (
              <FilterChip
                key={day}
                label={day}
                active={availabilityDays[day]}
                onPress={() => toggleDay(day)}
              />
            ))}
          </View>
          <View style={styles.timeRow}>
            <InputField label="From" value={fromTime} onChangeText={setFromTime} containerStyle={styles.half} />
            <InputField label="To" value={toTime} onChangeText={setToTime} containerStyle={styles.half} />
          </View>

          <SectionTitle title="Amenities" />
          <View style={styles.chipWrap}>
            {amenityOptions.map((option) => (
              <FilterChip
                key={option}
                label={option}
                active={selectedAmenities.includes(option)}
                onPress={() => toggleAmenity(option)}
              />
            ))}
          </View>

          <PrimaryCTA
            label={chargerId ? "Update Charger" : "Save Charger"}
            onPress={save}
            loading={saving}
          />
        </Animated.View>
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  card: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    ...Shadows.card,
  },
  mapWrap: {
    height: 190,
    borderRadius: Radius.lg,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  map: {
    flex: 1,
  },
  coordText: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  inlineLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  timeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  half: {
    flex: 1,
  },
});
