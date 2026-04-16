import { useCallback, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert,
  FlatList,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  ChargerCardSkeleton,
  DateTimeInput,
  EmptyStateCard,
  GradientButton,
  ImageGallery,
  InfoPill,
  InputField,
  PremiumCard,
  PressableScale,
  RatingStarsRow,
  ScreenContainer,
  SecondaryButton,
  SectionTitle,
  StickyActionBar,
  TrustBadge,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { AppConfig } from "@/src/constants/app";
import { useBadgeCounts, useChargerDetail, useWishlist } from "@/src/hooks";
import { useChargerStats } from "@/src/hooks/useChargerStats";
import { useQuery } from "@tanstack/react-query";
import { listVehiclesByUser } from "@/src/features/vehicles/vehicle.repository";
import { useUserLocation, getDistanceKm, formatDistance } from "@/src/hooks/useUserLocation";
import { useThemeColors } from "@/src/hooks/useThemeColors";
import { getDetailImageUrl } from "@/src/services/imageService";
import { getBookingAvailabilityError } from "@/src/hooks/useChargerDetail";
import { AvailabilityBar } from "@/src/components/ui/AvailabilityBar";
import { getUserProfile } from "@/src/features/users/user.repository";

export default function ChargerDetailRoute() {
  const router = useRouter();
  const { chargerId, fromBadge } = useLocalSearchParams<{ chargerId: string; fromBadge?: string }>();
  const { user } = useAuth();
  const colors = useThemeColors();
  const { markChargerUpdatesSeen } = useBadgeCounts();
  const { isSaved, toggleSaved } = useWishlist();
  const { location } = useUserLocation();

  const userId = useMemo(() => user?.id, [user?.id]);

  const { data, isLoading, error, refresh } = useChargerDetail(chargerId, userId);
  const { data: chargerStats } = useChargerStats(chargerId);

  // Fetch host profile for host section
  const hostProfileQuery = useQuery({
    queryKey: ["host-profile", data.charger?.hostUserId],
    queryFn: async () => {
      if (!data.charger?.hostUserId) return null;
      return getUserProfile(data.charger.hostUserId);
    },
    enabled: !!data.charger?.hostUserId,
  });
  const hostProfile = hostProfileQuery.data;

  // Fetch driver's vehicle for battery capacity validation
  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", userId],
    queryFn: () => listVehiclesByUser(userId!),
    enabled: Boolean(userId),
  });
  const vehicleMaxKwh = vehiclesQuery.data?.[0]?.batteryCapacityKWh ?? 120;

  const [startDate, setStartDate] = useState(() => new Date(Date.now() + AppConfig.BOOKING_DEFAULTS.defaultDurationHours * 3600000));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 2 * AppConfig.BOOKING_DEFAULTS.defaultDurationHours * 3600000));
  const [estimatedKWh, setEstimatedKWh] = useState<number>(AppConfig.BOOKING_DEFAULTS.defaultEstimatedKwh);
  const charger = data.charger;
  const activeBooking = data.activeBooking;
  const bookingValidationError = getBookingAvailabilityError(charger, startDate, endDate);

  const distanceKm = useMemo(() => {
    if (!location || !charger) return null;
    return getDistanceKm(location.latitude, location.longitude, charger.latitude, charger.longitude);
  }, [location, charger]);

  const isVerified = charger ? charger.verificationScore > AppConfig.VERIFICATION.verifiedThreshold : false;

  useFocusEffect(
    useCallback(() => {
      if (fromBadge === "chargerUpdates") {
        void markChargerUpdatesSeen();
      }
    }, [fromBadge, markChargerUpdatesSeen])
  );

  const handleShare = async () => {
    if (!charger) return;
    await Share.share({
      message: `Check out ${charger.name} on VehicleGrid — EV charging in ${charger.suburb}! ${charger.maxPowerKw}kW at $${charger.pricingPerKwh.toFixed(2)}/kWh`,
    });
  };

  const submitBooking = () => {
    if (!charger) return;
    if (bookingValidationError) {
      Alert.alert("Booking", bookingValidationError);
      return;
    }

    const subtotal = charger.pricingPerKwh * estimatedKWh;
    const platformFee = subtotal * (AppConfig.PLATFORM_FEE_PERCENT / 100);
    const totalAmount = subtotal + platformFee;

    // Navigate to checkout — booking record is created there, after payment is authorised
    router.push({
      pathname: "/(app)/checkout" as any,
      params: {
        chargerId,
        hostUserId: charger.hostUserId,
        startTimeIso: startDate.toISOString(),
        endTimeIso: endDate.toISOString(),
        estimatedKWh: String(estimatedKWh),
        chargerName: charger.name,
        totalAmount: String(totalAmount),
        platformFee: String(platformFee),
        pricePerKwh: String(charger.pricingPerKwh),
        hostStripeAccountId: data.hostStripeAccountId ?? "",
      },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScreenContainer>
          <ChargerCardSkeleton />
          <ChargerCardSkeleton />
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  if (!charger) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScreenContainer>
          <EmptyStateCard
            icon="⚡"
            title="Charger not found"
            message={error || "This charger may have been removed."}
            actionLabel="Retry"
            onAction={refresh}
          />
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScreenContainer bottomInset={112}>
        {/* Floating header actions */}
        <View style={styles.floatingHeader}>
          <PressableScale onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </PressableScale>
          <View style={{ flex: 1 }} />
          <PressableScale onPress={handleShare} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={20} color={Colors.textPrimary} />
          </PressableScale>
          <PressableScale onPress={() => toggleSaved(charger.id)} style={styles.headerBtn}>
            <Ionicons
              name={isSaved(charger.id) ? "heart" : "heart-outline"}
              size={20}
              color={isSaved(charger.id) ? Colors.error : Colors.textPrimary}
            />
          </PressableScale>
        </View>

        {/* Image Gallery */}
        <Animated.View entering={FadeIn.duration(240)}>
          {charger.images && charger.images.length > 0 ? (
            <ImageGallery images={charger.images.map((img) => getDetailImageUrl(img))} height={220} />
          ) : (
            <LinearGradient
              colors={[Colors.primaryLight, Colors.accentMuted]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroHeader}
            >
              <Ionicons name="flash" size={48} color={Colors.primaryDark} />
              <Text style={styles.heroText}>No photos yet</Text>
            </LinearGradient>
          )}
        </Animated.View>

        {/* Main Info Card */}
        <Animated.View entering={FadeInDown.duration(260)}>
          <PremiumCard style={styles.mainCard}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={Typography.pageTitle}>{charger.name}</Text>
                <Text style={Typography.body}>Hosted by {data.hostName}</Text>
              </View>
              <TrustBadge type={isVerified ? "verified" : "community"} />
            </View>

            {/* Rating + Reviews (Airbnb style) */}
            <View style={styles.ratingRow}>
              <RatingStarsRow
                rating={data.averageRating || 0}
                count={data.totalReviews}
                snippet={data.totalReviews ? undefined : "No reviews yet"}
              />
              {distanceKm !== null && (
                <View style={styles.distanceChip}>
                  <Ionicons name="location-outline" size={13} color={Colors.primary} />
                  <Text style={styles.distanceText}>{formatDistance(distanceKm)} away</Text>
                </View>
              )}
            </View>

            {/* Info pills */}
            <View style={styles.pillRow}>
              <InfoPill label={`${charger.maxPowerKw} kW`} variant="primary" />
              <InfoPill label={charger.connectors.map((c) => c.type).join(" • ")} />
              <InfoPill label={`$${charger.pricingPerKwh.toFixed(2)}/kWh`} variant="success" />
              <InfoPill
                label={charger.status}
                variant={charger.status === "approved" ? "success" : charger.status === "rejected" ? "error" : "warning"}
              />
            </View>

            {/* Airbnb-style highlight row */}
            <View style={styles.highlightsRow}>
              {isVerified && (
                <View style={styles.highlight}>
                  <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
                  <View>
                    <Text style={styles.highlightTitle}>Verified Charger</Text>
                    <Text style={styles.highlightSub}>Identity and location confirmed</Text>
                  </View>
                </View>
              )}
              <View style={styles.highlight}>
                <Ionicons name="flash" size={20} color={Colors.warning} />
                <View>
                  <Text style={styles.highlightTitle}>Instant Confirmation</Text>
                  <Text style={styles.highlightSub}>Host typically responds within 1 hour</Text>
                </View>
              </View>
              <View style={styles.highlight}>
                <Ionicons name="close-circle-outline" size={20} color={Colors.textMuted} />
                <View>
                  <Text style={styles.highlightTitle}>Free Cancellation</Text>
                  <Text style={styles.highlightSub}>Cancel up to 2 hours before start</Text>
                </View>
              </View>
            </View>
          </PremiumCard>
        </Animated.View>

        {/* Stats Row */}
        {chargerStats && (
          <Animated.View entering={FadeInDown.delay(60).duration(260)}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {chargerStats.avgRating > 0 ? chargerStats.avgRating.toFixed(1) : "—"}
                </Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{chargerStats.totalSessions}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {chargerStats.avgSessionMinutes > 0 ? `${chargerStats.avgSessionMinutes}m` : "—"}
                </Text>
                <Text style={styles.statLabel}>Avg duration</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Availability Bar */}
        <Animated.View entering={FadeInDown.delay(70).duration(260)}>
          <PremiumCard style={styles.mainCard}>
            <SectionTitle title="Today's availability" topSpacing={Spacing.xs} />
            <AvailabilityBar chargerId={chargerId} />
          </PremiumCard>
        </Animated.View>

        {/* Amenities */}
        <Animated.View entering={FadeInDown.delay(80).duration(260)}>
          <PremiumCard style={styles.mainCard}>
            <SectionTitle title="What this charger offers" topSpacing={Spacing.xs} />
            <View style={styles.amenitiesGrid}>
              {(charger.amenities ?? []).length ? (
                (charger.amenities ?? []).map((amenity) => (
                  <View key={amenity} style={styles.amenityItem}>
                    <Ionicons
                      name={getAmenityIcon(amenity)}
                      size={20}
                      color={Colors.textSecondary}
                    />
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))
              ) : (
                <Text style={Typography.body}>No amenities listed</Text>
              )}
            </View>
          </PremiumCard>
        </Animated.View>

        {/* Availability */}
        <Animated.View entering={FadeInDown.delay(120).duration(260)}>
          <PremiumCard style={styles.mainCard}>
            <SectionTitle title="Availability" topSpacing={Spacing.xs} />
            <View style={styles.availabilityBox}>
              <Ionicons name="time-outline" size={24} color={Colors.primaryDark} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.availabilityTitle}>
                  {charger.availabilityWindow
                    ? `${charger.availabilityWindow.startTime} – ${charger.availabilityWindow.endTime}`
                    : charger.availabilityNote || "Always available"}
                </Text>
                {charger.availabilityWindow ? (
                  <View style={styles.dayRow}>
                    {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((day) => (
                      <View
                        key={day}
                        style={[
                          styles.dayChip,
                          charger.availabilityWindow?.days.includes(day) && styles.dayChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayChipText,
                            charger.availabilityWindow?.days.includes(day) && styles.dayChipTextActive,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </PremiumCard>
        </Animated.View>

        {/* Active Booking Banner or Booking Form */}
        <Animated.View entering={FadeInDown.delay(160).duration(260)}>
          {activeBooking ? (
            <PremiumCard style={styles.mainCard}>
              <SectionTitle title="Your Active Booking" topSpacing={Spacing.xs} />
              <View style={styles.activeBookingBanner}>
                <Ionicons
                  name={activeBooking.status === "active" ? "flash" : activeBooking.status === "approved" ? "checkmark-circle" : "time"}
                  size={24}
                  color={activeBooking.status === "active" ? Colors.warning : activeBooking.status === "approved" ? Colors.success : Colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={Typography.cardTitle}>
                    {activeBooking.status === "active" ? "Charging In Progress" : activeBooking.status === "approved" ? "Booking Approved" : "Awaiting Host Approval"}
                  </Text>
                  <Text style={Typography.caption}>
                    {new Date(activeBooking.startTimeIso).toLocaleString()} – {new Date(activeBooking.endTimeIso).toLocaleTimeString()}
                  </Text>
                  <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2 }]}>
                    {activeBooking.estimatedKWh} kWh · ${activeBooking.totalAmount.toFixed(2)}
                  </Text>
                </View>
                <InfoPill
                  label={activeBooking.status.replace("_", " ")}
                  variant={activeBooking.status === "active" ? "warning" : activeBooking.status === "approved" ? "success" : "primary"}
                />
              </View>
            </PremiumCard>
          ) : (
            <PremiumCard style={styles.mainCard}>
              <SectionTitle title="Book This Charger" topSpacing={Spacing.xs} />

              {/* Price breakdown (Airbnb-style) */}
              <View style={styles.priceBreakdown}>
                <View style={styles.priceRow}>
                  <Text style={Typography.body}>
                    ${charger.pricingPerKwh.toFixed(2)} x {estimatedKWh} kWh
                  </Text>
                  <Text style={Typography.body}>
                    ${(charger.pricingPerKwh * estimatedKWh).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={Typography.body}>Platform fee ({AppConfig.PLATFORM_FEE_PERCENT}%)</Text>
                  <Text style={Typography.body}>
                    ${(charger.pricingPerKwh * estimatedKWh * AppConfig.PLATFORM_FEE_PERCENT / 100).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.priceDivider} />
                <View style={styles.priceRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    ${(charger.pricingPerKwh * estimatedKWh * (1 + AppConfig.PLATFORM_FEE_PERCENT / 100)).toFixed(2)}
                  </Text>
                </View>
              </View>

              <DateTimeInput label="Start" value={startDate} onChange={setStartDate} mode="datetime" />
              <DateTimeInput label="End" value={endDate} onChange={setEndDate} mode="datetime" />
              <InputField
                label={`Estimated Energy (kWh) — max ${vehicleMaxKwh}`}
                value={String(estimatedKWh)}
                onChangeText={(value) => setEstimatedKWh(Math.min(Math.max(5, Number(value) || 5), vehicleMaxKwh))}
                keyboardType="numeric"
              />
              {bookingValidationError ? (
                <Text style={styles.validationText}>{bookingValidationError}</Text>
              ) : null}
            </PremiumCard>
          )}
        </Animated.View>

        {/* Host Profile */}
        {hostProfile && (
          <Animated.View entering={FadeInDown.delay(180).duration(260)}>
            <PremiumCard style={styles.mainCard}>
              <SectionTitle title="Your Host" topSpacing={Spacing.xs} />
              <View style={styles.hostRow}>
                <View style={styles.hostAvatar}>
                  <Text style={styles.hostAvatarText}>
                    {hostProfile.displayName?.charAt(0)?.toUpperCase() ?? "H"}
                  </Text>
                </View>
                <View style={styles.hostInfo}>
                  <Text style={Typography.cardTitle}>{hostProfile.displayName}</Text>
                  <Text style={Typography.caption}>
                    Host since {new Date(hostProfile.createdAtIso).getFullYear()}
                  </Text>
                  {(hostProfile as any).avgResponseMinutes != null && (
                    <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2 }]}>
                      {formatResponseTime((hostProfile as any).avgResponseMinutes)}
                    </Text>
                  )}
                </View>
              </View>
              {charger.availabilityNote ? (
                <View style={styles.hostQuote}>
                  <Text style={[Typography.body, { fontStyle: "italic" }]}>
                    "{charger.availabilityNote}"
                  </Text>
                </View>
              ) : null}
            </PremiumCard>
          </Animated.View>
        )}

        {/* Reviews */}
        <Animated.View entering={FadeInDown.delay(200).duration(260)}>
          <PremiumCard style={styles.mainCard}>
            <SectionTitle
              title={data.totalReviews > 0
                ? `${data.averageRating?.toFixed(1)} · ${data.totalReviews} review${data.totalReviews === 1 ? "" : "s"}`
                : "Reviews"
              }
              topSpacing={Spacing.xs}
            />
            <FlatList
              data={data.reviews}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.reviewRow}>
                  <View style={styles.reviewHeader}>
                    <RatingStarsRow rating={item.rating} />
                    <Text style={styles.reviewDate}>
                      {new Date(item.createdAtIso).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.reviewText}>{item.comment || "No review comment."}</Text>
                </View>
              )}
              ListEmptyComponent={
                <EmptyStateCard
                  icon="⭐"
                  title="No reviews yet"
                  message="Be the first to leave feedback after a completed booking."
                />
              }
            />
          </PremiumCard>
        </Animated.View>

        {/* Cancellation policy (Airbnb-style) */}
        <Animated.View entering={FadeInDown.delay(240).duration(260)}>
          <PremiumCard style={styles.mainCard}>
            <SectionTitle title="Cancellation Policy" topSpacing={Spacing.xs} />
            <View style={styles.policyRow}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={Typography.body}>
                Free cancellation up to 2 hours before your booking starts.
              </Text>
            </View>
            <View style={styles.policyRow}>
              <Ionicons name="information-circle" size={18} color={Colors.warning} />
              <Text style={Typography.body}>
                Cancellations within 2 hours may incur a fee.
              </Text>
            </View>
          </PremiumCard>
        </Animated.View>
      </ScreenContainer>

      <StickyActionBar>
        <View style={styles.stickyContent}>
          <View>
            <Text style={styles.stickyPrice}>
              ${charger.pricingPerKwh.toFixed(2)}{" "}
              <Text style={styles.stickyPriceUnit}>/kWh</Text>
            </Text>
            {data.totalReviews > 0 && (
              <Text style={styles.stickyRating}>
                ★ {data.averageRating?.toFixed(1)} · {data.totalReviews} reviews
              </Text>
            )}
          </View>
          {activeBooking ? (
            <SecondaryButton
              label="View Bookings"
              onPress={() => router.push("/(app)/(tabs)/bookings" as any)}
              style={styles.bookBtn}
            />
          ) : (
            <GradientButton
              label="Request Booking"
              onPress={submitBooking}
              disabled={Boolean(bookingValidationError)}
              style={styles.bookBtn}
            />
          )}
        </View>
      </StickyActionBar>
    </SafeAreaView>
  );
}

function formatResponseTime(minutes: number | null | undefined): string {
  if (minutes == null) return "New host";
  if (minutes < 60) return `Usually responds within ${minutes} minutes`;
  if (minutes < 240) return `Usually responds within ${Math.round(minutes / 60)} hours`;
  if (minutes < 1440) return "Usually responds same day";
  return "Response time may vary";
}

function getAmenityIcon(amenity: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    WiFi: "wifi",
    Parking: "car",
    Restroom: "water",
    Cafe: "cafe",
    CCTV: "videocam",
    Lighting: "bulb",
  };
  return map[amenity] || "ellipse";
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  floatingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.subtle,
  },
  heroHeader: {
    height: 220,
    borderRadius: Radius.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  heroText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  mainCard: {
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  distanceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  distanceText: {
    ...Typography.badge,
    color: Colors.primary,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  // Airbnb highlights
  highlightsRow: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.lg,
  },
  highlight: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  highlightTitle: {
    ...Typography.cardTitle,
  },
  highlightSub: {
    ...Typography.caption,
    marginTop: 1,
  },
  // Amenities grid
  amenitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  amenityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    width: "45%",
    paddingVertical: Spacing.xs,
  },
  amenityText: {
    ...Typography.body,
  },
  // Availability
  availabilityBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  // availabilityIcon handled by Ionicons inline
  availabilityTitle: {
    ...Typography.cardTitle,
  },
  dayRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: Spacing.xs,
  },
  dayChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  dayChipActive: {
    backgroundColor: Colors.accent,
  },
  dayChipText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textMuted,
  },
  dayChipTextActive: {
    color: Colors.textInverse,
    fontWeight: "700",
  },
  // Price breakdown
  priceBreakdown: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priceDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  totalLabel: {
    ...Typography.cardTitle,
    fontWeight: "700",
  },
  totalValue: {
    ...Typography.priceHighlight,
  },
  validationText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  activeBookingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  // Reviews
  reviewRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewDate: {
    ...Typography.caption,
  },
  reviewText: {
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  // Cancellation policy
  policyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  // Sticky bar (Airbnb-style)
  stickyContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  stickyPriceUnit: {
    fontSize: 14,
    fontWeight: "400",
    color: Colors.textMuted,
  },
  stickyRating: {
    ...Typography.caption,
    marginTop: 2,
  },
  bookBtn: {
    flex: 0,
    width: 180,
  },
  // Stats row
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    ...Typography.sectionTitle,
    fontSize: 20,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  // Host profile
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  hostAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textInverse,
  },
  hostInfo: {
    flex: 1,
  },
  hostQuote: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
});
