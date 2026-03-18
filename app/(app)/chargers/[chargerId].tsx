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
import { useUserLocation, getDistanceKm, formatDistance } from "@/src/hooks/useUserLocation";
import { useThemeColors } from "@/src/hooks/useThemeColors";
import { ensurePublicUrl } from "@/src/services/imageService";
import { getBookingAvailabilityError } from "@/src/hooks/useChargerDetail";

export default function ChargerDetailRoute() {
  const router = useRouter();
  const { chargerId, fromBadge } = useLocalSearchParams<{ chargerId: string; fromBadge?: string }>();
  const { user } = useAuth();
  const colors = useThemeColors();
  const { markChargerUpdatesSeen } = useBadgeCounts();
  const { isSaved, toggleSaved } = useWishlist();
  const { location } = useUserLocation();

  const userId = useMemo(() => user?.id, [user?.id]);

  const { data, isLoading, error, requestBooking, refresh } = useChargerDetail(chargerId, userId);

  const [startDate, setStartDate] = useState(() => new Date(Date.now() + AppConfig.BOOKING_DEFAULTS.defaultDurationHours * 3600000));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 2 * AppConfig.BOOKING_DEFAULTS.defaultDurationHours * 3600000));
  const [estimatedKWh, setEstimatedKWh] = useState<number>(AppConfig.BOOKING_DEFAULTS.defaultEstimatedKwh);
  const [submitting, setSubmitting] = useState(false);

  const charger = data.charger;
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

  const submitBooking = async () => {
    if (!charger) return;
    if (bookingValidationError) {
      Alert.alert("Booking", bookingValidationError);
      return;
    }
    try {
      setSubmitting(true);
      await requestBooking({
        start: startDate,
        end: endDate,
        estimatedKWh,
      });
      Alert.alert("Booking requested", "Your request was sent to the host.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to request booking.";
      Alert.alert("Booking failed", message);
    } finally {
      setSubmitting(false);
    }
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
            <ImageGallery images={charger.images.map((img) => ensurePublicUrl(img))} height={220} />
          ) : (
            <View style={styles.heroHeader}>
              <Text style={styles.heroIcon}>⚡</Text>
              <Text style={styles.heroText}>No photos yet</Text>
            </View>
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

        {/* Amenities */}
        <Animated.View entering={FadeInDown.delay(80).duration(260)}>
          <PremiumCard style={styles.mainCard}>
            <SectionTitle title="What this charger offers" topSpacing={Spacing.xs} />
            <View style={styles.amenitiesGrid}>
              {charger.amenities.length ? (
                charger.amenities.map((amenity) => (
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
              <Text style={styles.availabilityIcon}>🕐</Text>
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

        {/* Booking Form */}
        <Animated.View entering={FadeInDown.delay(160).duration(260)}>
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
              label="Estimated Energy (kWh)"
              value={String(estimatedKWh)}
              onChangeText={(value) => setEstimatedKWh(Math.max(5, Number(value) || 5))}
              keyboardType="numeric"
            />
            {bookingValidationError ? (
              <Text style={styles.validationText}>{bookingValidationError}</Text>
            ) : null}
          </PremiumCard>
        </Animated.View>

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
          <GradientButton
            label="Request Booking"
            onPress={submitBooking}
            loading={submitting}
            disabled={Boolean(bookingValidationError)}
            style={styles.bookBtn}
          />
        </View>
      </StickyActionBar>
    </SafeAreaView>
  );
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
    height: 180,
    borderRadius: Radius.card,
    backgroundColor: Colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  heroIcon: {
    fontSize: 48,
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
  availabilityIcon: {
    fontSize: 24,
    marginTop: 2,
  },
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
});
