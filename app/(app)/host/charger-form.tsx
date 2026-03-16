import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  Image,
  Pressable,
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
  GradientButton,
  InputField,
  PremiumCard,
  ScreenContainer,
  SectionTitle,
  Typography,
  Colors,
  Radius,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { type AvailabilityDay, type ConnectorType } from "@/src/features/chargers";
import { useHostChargers } from "@/src/hooks";
import {
  pickAndUploadChargerImage,
  captureAndUploadChargerImage,
  deleteChargerImage,
} from "@/src/services/imageService";

const MAX_PHOTOS = 6;
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
  const { user } = useAuth();

  const userId = useMemo(
    () => user?.id,
    [user?.id]
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

  // Photo upload state
  const [images, setImages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

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
        if (charger.images) {
          setImages(charger.images);
        }
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

  // Photo upload handlers
  const handleAddPhoto = () => {
    if (images.length >= MAX_PHOTOS) {
      Alert.alert("Limit reached", `You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    Alert.alert("Add Photo", "Choose a source", [
      {
        text: "Camera",
        onPress: handleCameraCapture,
      },
      {
        text: "Gallery",
        onPress: handleGalleryPick,
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleGalleryPick = async () => {
    const targetId = chargerId || "new-charger";
    try {
      setUploading(true);
      setUploadProgress(0);
      const url = await pickAndUploadChargerImage(targetId, setUploadProgress);
      setImages((prev) => [...prev, url]);
    } catch (err) {
      if (err instanceof Error && err.message.includes("cancelled")) return;
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleCameraCapture = async () => {
    const targetId = chargerId || "new-charger";
    try {
      setUploading(true);
      setUploadProgress(0);
      const url = await captureAndUploadChargerImage(targetId, setUploadProgress);
      setImages((prev) => [...prev, url]);
    } catch (err) {
      if (err instanceof Error && err.message.includes("cancelled")) return;
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDeletePhoto = (index: number) => {
    const url = images[index];
    Alert.alert("Delete Photo", "Remove this photo from the listing?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteChargerImage(url);
          } catch {
            // best-effort deletion from storage
          }
          setImages((prev) => prev.filter((_, i) => i !== index));
        },
      },
    ]);
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
          images,
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

        {/* Photos Section */}
        <Animated.View entering={FadeInDown.duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Photos" topSpacing={Spacing.xs} />
            <Text style={styles.photoHint}>
              Add up to {MAX_PHOTOS} photos. Great photos attract more bookings.
            </Text>

            {images.length > 0 ? (
              <View style={styles.photoGrid}>
                {images.map((uri, index) => (
                  <View key={uri} style={styles.photoThumb}>
                    <Image source={{ uri }} style={styles.thumbImage} />
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => handleDeletePhoto(index)}
                      hitSlop={8}
                    >
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                {images.length < MAX_PHOTOS && (
                  <Pressable style={styles.addPhotoBtn} onPress={handleAddPhoto}>
                    <Text style={styles.addPhotoIcon}>+</Text>
                    <Text style={styles.addPhotoLabel}>Add</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable style={styles.emptyPhotoArea} onPress={handleAddPhoto}>
                <Text style={styles.emptyPhotoIcon}>📷</Text>
                <Text style={styles.emptyPhotoText}>Tap to add your first photo</Text>
              </Pressable>
            )}

            {uploading && uploadProgress !== null && (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(uploadProgress * 100)}% uploaded
                </Text>
              </View>
            )}

            <Text style={styles.photoCount}>
              {images.length}/{MAX_PHOTOS} photos
            </Text>
          </PremiumCard>
        </Animated.View>

        {/* Basic Info */}
        <Animated.View entering={FadeInDown.delay(60).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Basic Info" topSpacing={Spacing.xs} />
            <InputField label="Name" value={name} onChangeText={setName} />
            <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
          </PremiumCard>
        </Animated.View>

        {/* Location */}
        <Animated.View entering={FadeInDown.delay(120).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Location" topSpacing={Spacing.xs} />
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
          </PremiumCard>
        </Animated.View>

        {/* Specs */}
        <Animated.View entering={FadeInDown.delay(180).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Specs" topSpacing={Spacing.xs} />
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
          </PremiumCard>
        </Animated.View>

        {/* Availability */}
        <Animated.View entering={FadeInDown.delay(240).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Availability" topSpacing={Spacing.xs} />
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
          </PremiumCard>
        </Animated.View>

        {/* Amenities */}
        <Animated.View entering={FadeInDown.delay(300).duration(260)}>
          <PremiumCard style={styles.section}>
            <SectionTitle title="Amenities" topSpacing={Spacing.xs} />
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
          </PremiumCard>
        </Animated.View>

        <GradientButton
          label={chargerId ? "Update Charger" : "Save Charger"}
          onPress={save}
          loading={saving}
          style={styles.saveBtn}
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  section: {
    marginBottom: Spacing.md,
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
  saveBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },

  // Photo upload styles
  photoHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: Radius.md,
    overflow: "hidden",
    position: "relative",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  deleteBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  addPhotoBtn: {
    width: 100,
    height: 100,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceAlt,
  },
  addPhotoIcon: {
    fontSize: 28,
    color: Colors.accent,
    fontWeight: "300",
  },
  addPhotoLabel: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: "600",
    marginTop: 2,
  },
  emptyPhotoArea: {
    height: 140,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceAlt,
  },
  emptyPhotoIcon: {
    fontSize: 36,
    marginBottom: Spacing.xs,
  },
  emptyPhotoText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  progressWrap: {
    marginTop: Spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceAlt,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.accent,
    marginTop: 4,
    textAlign: "center",
  },
  photoCount: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    textAlign: "right",
  },
});
