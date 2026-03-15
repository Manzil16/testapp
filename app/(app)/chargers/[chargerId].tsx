import { useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  ChargerCardSkeleton,
  DateTimeInput,
  EmptyStateCard,
  InfoPill,
  InputField,
  PrimaryCTA,
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
import { useChargerDetail } from "@/src/hooks";
import { getBookingAvailabilityError } from "@/src/hooks/useChargerDetail";

export default function ChargerDetailRoute() {
  const { chargerId } = useLocalSearchParams<{ chargerId: string }>();
  const { authUser, sessionUser } = useAuth();

  const userId = useMemo(
    () => authUser?.uid || sessionUser?.uid,
    [authUser?.uid, sessionUser?.uid]
  );

  const { data, isLoading, error, requestBooking, refresh } = useChargerDetail(chargerId, userId);

  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [estimatedKWh, setEstimatedKWh] = useState(35);
  const [submitting, setSubmitting] = useState(false);

  const charger = data.charger;
  const availabilityLabel = charger?.availabilityWindow
    ? `${charger.availabilityWindow.days.join(", ")} ${charger.availabilityWindow.startTime}-${charger.availabilityWindow.endTime}`
    : charger?.availabilityNote || "Host availability not specified.";
  const bookingValidationError = getBookingAvailabilityError(charger, startDate, endDate);

  const submitBooking = async () => {
    if (!charger) {
      return;
    }

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
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScreenContainer>
          <ChargerCardSkeleton />
          <ChargerCardSkeleton />
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  if (!charger) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
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
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer bottomInset={112}>
        <Animated.View entering={FadeIn.duration(240)} style={styles.heroHeader}>
          <Text style={styles.heroIcon}>⚡</Text>
          <Text style={styles.heroText}>Image Upload Coming Soon</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(260)} style={styles.mainCard}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={Typography.pageTitle}>{charger.name}</Text>
              <Text style={Typography.body}>Hosted by {data.hostName}</Text>
            </View>
            <TrustBadge
              type={charger.verificationScore > 85 ? "verified" : "community"}
            />
          </View>

          <RatingStarsRow
            rating={data.averageRating || 0}
            count={data.totalReviews}
            snippet={data.totalReviews ? undefined : "No reviews yet"}
            style={styles.rating}
          />

          <View style={styles.pillRow}>
            <InfoPill label={`${charger.maxPowerKw} kW`} variant="primary" />
            <InfoPill label={charger.connectors.map((c) => c.type).join(" • ")} />
            <InfoPill label={`$${charger.pricingPerKwh.toFixed(2)}/kWh`} variant="success" />
            <InfoPill
              label={charger.status.replace("_", " ")}
              variant={charger.status === "verified" ? "success" : "warning"}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(260)} style={styles.mainCard}>
          <SectionTitle title="Amenities" topSpacing={Spacing.xs} />
          <View style={styles.pillRow}>
            {charger.amenities.length ? (
              charger.amenities.map((amenity) => <InfoPill key={amenity} label={amenity} />)
            ) : (
              <InfoPill label="No amenities listed" />
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(260)} style={styles.mainCard}>
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
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(260)} style={styles.mainCard}>
          <SectionTitle title="Book This Charger" topSpacing={Spacing.xs} />
          <DateTimeInput label="Start" value={startDate} onChange={setStartDate} mode="datetime" />
          <DateTimeInput label="End" value={endDate} onChange={setEndDate} mode="datetime" />
          <InputField
            label="Estimated Energy (kWh)"
            value={String(estimatedKWh)}
            onChangeText={(value) => setEstimatedKWh(Math.max(5, Number(value) || 5))}
            keyboardType="numeric"
          />
          <Text style={styles.estimateText}>Estimated energy: {estimatedKWh} kWh</Text>
          {bookingValidationError ? (
            <Text style={styles.validationText}>{bookingValidationError}</Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(260)} style={styles.mainCard}>
          <SectionTitle title="Reviews" topSpacing={Spacing.xs} />
          <FlatList
            data={data.reviews}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.reviewRow}>
                <RatingStarsRow rating={item.rating} />
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
        </Animated.View>
      </ScreenContainer>

      <StickyActionBar>
        <PrimaryCTA
          label="Request Booking"
          onPress={submitBooking}
          loading={submitting}
          disabled={Boolean(bookingValidationError)}
        />
      </StickyActionBar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  heroHeader: {
    height: 180,
    borderRadius: Radius.card,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  heroIcon: {
    fontSize: 48,
  },
  heroText: {
    ...Typography.caption,
    color: Colors.textInverse,
    marginTop: Spacing.xs,
  },
  mainCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  rating: {
    marginTop: Spacing.sm,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  estimateText: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  availabilityBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
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
    color: Colors.textPrimary,
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
    backgroundColor: Colors.background,
  },
  dayChipActive: {
    backgroundColor: Colors.primary,
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
  validationText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  reviewRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  reviewText: {
    ...Typography.body,
    marginTop: Spacing.xs,
  },
});
