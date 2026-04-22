import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
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
import { useHostChargers, usePricingAssistant } from "@/src/hooks";
import { useThemeColors } from "@/src/hooks/useThemeColors";
import { AppConfig } from "@/src/constants/app";
import {
  pickAndUploadChargerImage,
  captureAndUploadChargerImage,
  deleteChargerImage,
  ensurePublicUrl,
} from "@/src/services/imageService";
import { searchAddress, type GeoResult } from "@/src/services/geocodingService";

const MAX_PHOTOS = AppConfig.CHARGER_DEFAULTS.maxPhotos;
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

  const colors = useThemeColors();
  const { error, actions } = useHostChargers(userId);

  const [loading, setLoading] = useState(Boolean(chargerId));
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [stateCode, setStateCode] = useState("NSW");

  const [latitude, setLatitude] = useState<number>(AppConfig.DEFAULT_REGION.latitude);
  const [longitude, setLongitude] = useState<number>(AppConfig.DEFAULT_REGION.longitude);

  const [powerKw, setPowerKw] = useState(String(AppConfig.CHARGER_DEFAULTS.powerKw));
  const [pricePerKwh, setPricePerKwh] = useState(String(AppConfig.CHARGER_DEFAULTS.pricePerKwh));
  const [selectedConnectors, setSelectedConnectors] = useState<ConnectorType[]>(["Type2"]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const [availabilityDays, setAvailabilityDays] = useState<Record<AvailabilityDay, boolean>>(
    Object.fromEntries(weekdays.map((day) => [day, true])) as Record<AvailabilityDay, boolean>
  );
  const [fromTime, setFromTime] = useState<string>(AppConfig.CHARGER_DEFAULTS.defaultStartTime);
  const [toTime, setToTime] = useState<string>(AppConfig.CHARGER_DEFAULTS.defaultEndTime);

  const pricingSuggestion = usePricingAssistant(parseNumber(powerKw, AppConfig.CHARGER_DEFAULTS.powerKw));

  // Photo upload state
  const [images, setImages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  // Address autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState<GeoResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

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
          setImages(charger.images.map((img) => ensurePublicUrl(img)));
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

  // Address autocomplete — debounced search
  const handleAddressChange = useCallback((text: string) => {
    setAddress(text);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (text.trim().length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchAddress(text, {
          nearLatitude: latitude,
          nearLongitude: longitude,
        });
        setAddressSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  }, [latitude, longitude]);

  const handleSelectSuggestion = useCallback((result: GeoResult) => {
    setAddress(result.primaryText);
    setShowSuggestions(false);
    setAddressSuggestions([]);

    // Parse suburb and state from secondaryText (e.g. "Hurstville, New South Wales, 2220")
    if (result.secondaryText) {
      const parts = result.secondaryText.split(",").map((s) => s.trim());
      if (parts[0]) setSuburb(parts[0]);
      if (parts[1]) {
        // Convert full state name to abbreviation
        const stateMap: Record<string, string> = {
          "New South Wales": "NSW",
          "Victoria": "VIC",
          "Queensland": "QLD",
          "Western Australia": "WA",
          "South Australia": "SA",
          "Tasmania": "TAS",
          "Northern Territory": "NT",
          "Australian Capital Territory": "ACT",
        };
        setStateCode(stateMap[parts[1]] || parts[1]);
      }
    }

    // Move map pin
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    mapRef.current?.animateToRegion({
      latitude: result.latitude,
      longitude: result.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 300);
  }, []);

  // Reverse geocode when map is tapped
  const handleMapPress = useCallback(async (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
    setLatitude(lat);
    setLongitude(lng);

    try {
      // Use Nominatim reverse geocoding
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "VehicleGrid-App/1.0 (vehiclegrid-app)",
          "Accept-Language": "en-AU,en;q=0.9",
        },
      });
      if (!response.ok) return;

      const data = await response.json();
      const addr = data.address;
      if (!addr) return;

      const road = addr.road;
      const houseNumber = addr.house_number;
      const streetAddress = houseNumber && road ? `${houseNumber} ${road}` : road || "";

      if (streetAddress) setAddress(streetAddress);

      const locality = addr.suburb || addr.city || addr.town || addr.village;
      if (locality) setSuburb(locality);

      if (addr.state) {
        const stateMap: Record<string, string> = {
          "New South Wales": "NSW",
          "Victoria": "VIC",
          "Queensland": "QLD",
          "Western Australia": "WA",
          "South Australia": "SA",
          "Tasmania": "TAS",
          "Northern Territory": "NT",
          "Australian Capital Territory": "ACT",
        };
        setStateCode(stateMap[addr.state] || addr.state);
      }
    } catch {
      // Reverse geocoding is best-effort
    }
  }, []);

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
          maxPowerKw: Math.max(AppConfig.CHARGER_DEFAULTS.minPowerKw, parseNumber(powerKw, AppConfig.CHARGER_DEFAULTS.powerKw)),
          pricingPerKwh: Math.max(AppConfig.CHARGER_DEFAULTS.minPricePerKwh, parseNumber(pricePerKwh, AppConfig.CHARGER_DEFAULTS.pricePerKwh)),
          connectors: selectedConnectors.map((type) => ({
            type,
            powerKw: Math.max(AppConfig.CHARGER_DEFAULTS.minPowerKw, parseNumber(powerKw, AppConfig.CHARGER_DEFAULTS.powerKw)),
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
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScreenContainer>
          <EmptyStateCard icon="⏳" title="Loading charger" message="Preparing form..." />
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Stack.Screen options={{ title: chargerId ? "Edit charger" : "Add charger" }} />
      <ScreenContainer>
        <Animated.View entering={FadeIn.duration(220)}>
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
                {images.map((uri, index) => {
                  const safeUri = ensurePublicUrl(uri);

                  return (
                    <View key={uri} style={styles.photoThumb}>
                      <Image source={{ uri: safeUri }} style={styles.thumbImage} />
                      <Pressable
                        style={styles.deleteBtn}
                        onPress={() => handleDeletePhoto(index)}
                        hitSlop={8}
                      >
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })}
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
            <View>
              <InputField label="Address" value={address} onChangeText={handleAddressChange} />
              {showSuggestions && addressSuggestions.length > 0 && (
                <View style={styles.suggestionsWrap}>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    style={styles.suggestionsList}
                  >
                    {addressSuggestions.map((result, index) => (
                      <Pressable
                        key={`${result.latitude}-${result.longitude}-${index}`}
                        style={styles.suggestionRow}
                        onPress={() => handleSelectSuggestion(result)}
                      >
                        <Text style={styles.suggestionPrimary} numberOfLines={1}>
                          {result.primaryText}
                        </Text>
                        {result.secondaryText ? (
                          <Text style={styles.suggestionSecondary} numberOfLines={1}>
                            {result.secondaryText}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <InputField label="Suburb" value={suburb} onChangeText={setSuburb} />
            <InputField label="State" value={stateCode} onChangeText={setStateCode} />

            <View style={styles.mapWrap}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude,
                  longitude,
                  latitudeDelta: 0.08,
                  longitudeDelta: 0.08,
                }}
                onPress={handleMapPress}
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
              hint={`Market range: $${pricingSuggestion.minPrice.toFixed(2)}-$${pricingSuggestion.maxPrice.toFixed(2)}/kWh`}
            />
            <Pressable
              style={styles.pricingSuggestion}
              onPress={() => setPricePerKwh(String(pricingSuggestion.suggestedPrice))}
            >
              <View style={styles.pricingSuggestionHeader}>
                <Text style={styles.pricingSuggestionIcon}>💡</Text>
                <Text style={styles.pricingSuggestionTitle}>Suggested: ${pricingSuggestion.suggestedPrice.toFixed(2)}/kWh</Text>
              </View>
              <Text style={styles.pricingSuggestionBody}>{pricingSuggestion.reasoning}</Text>
              <Text style={styles.pricingSuggestionTap}>Tap to apply</Text>
            </Pressable>
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
  pricingSuggestion: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  pricingSuggestionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pricingSuggestionIcon: {
    fontSize: 16,
  },
  pricingSuggestionTitle: {
    ...Typography.body,
    fontWeight: "700" as const,
    color: Colors.accent,
  },
  pricingSuggestionBody: {
    ...Typography.caption,
    lineHeight: 16,
  },
  pricingSuggestionTap: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.accent,
    fontWeight: "600" as const,
    marginTop: Spacing.xs,
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

  // Address autocomplete suggestions
  suggestionsWrap: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  suggestionPrimary: {
    ...Typography.body,
    fontWeight: "500" as const,
    color: Colors.textPrimary,
  },
  suggestionSecondary: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
