import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import {
  AnimatedListItem,
  BookingCard,
  BookingTimeline,
  BottomSheet,
  ChargerCardSkeleton,
  EmptyStateCard,
  InfoPill,
  InputField,
  PrimaryCTA,
  ScreenContainer,
  SegmentedControl,
  Toast,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { type Booking } from "@/src/features/bookings";
import { useBadgeCounts, useDriverBookings, useEntranceAnimation, useRefresh } from "@/src/hooks";

export default function DriverBookingsScreen() {
  const router = useRouter();
  const { segment: segmentParam, filter, fromBadge } = useLocalSearchParams<{
    segment?: string;
    filter?: string;
    fromBadge?: string;
  }>();
  const { user } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const { markSessionsSeen } = useBadgeCounts();
  const userId = useMemo(
    () => user?.id,
    [user?.id]
  );

  const {
    data,
    reviewedBookingIds,
    reviewRatingsByBookingId,
    isLoading,
    error,
    refresh,
    actions,
  } = useDriverBookings(userId);
  const { refreshing, onRefresh } = useRefresh(refresh);

  const [segment, setSegment] = useState<"upcoming" | "active" | "past">("upcoming");
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewedIds, setReviewedIds] = useState<Record<string, number>>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastText, setToastText] = useState("");

  useEffect(() => {
    if (segmentParam === "upcoming" || segmentParam === "active" || segmentParam === "past") {
      setSegment(segmentParam);
    }
  }, [segmentParam]);

  const isUnratedFilter = filter === "unrated";

  useFocusEffect(
    useCallback(() => {
      if (isUnratedFilter || fromBadge === "sessions") {
        void markSessionsSeen();
      }
    }, [fromBadge, isUnratedFilter, markSessionsSeen])
  );

  const list = useMemo(() => {
    const segmentList = data.bySegment[segment];
    if (!isUnratedFilter || segment !== "past") {
      return segmentList;
    }
    return segmentList.filter((booking) => booking.status === "completed" && !reviewedBookingIds.has(booking.id));
  }, [data.bySegment, isUnratedFilter, reviewedBookingIds, segment]);

  const showToast = (message: string) => {
    setToastText(message);
    setToastVisible(true);
  };

  const handleReviewSubmit = async () => {
    if (!reviewBooking) {
      return;
    }

    if (rating < 1 || rating > 5) {
      showToast("Rating must be between 1 and 5.");
      return;
    }

    await actions.leaveReview(reviewBooking, rating, comment);
    setReviewedIds((current) => ({ ...current, [reviewBooking.id]: rating }));
    setReviewBooking(null);
    setComment("");
    setRating(5);
    showToast("Review submitted.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <Text style={Typography.pageTitle}>Bookings</Text>
          <Text style={Typography.body}>Upcoming, active, and past charging sessions.</Text>

          <SegmentedControl
            segments={[
              { id: "upcoming", label: "Upcoming" },
              { id: "active", label: "Active" },
              { id: "past", label: "Past" },
            ]}
            activeId={segment}
            onChange={(id) => setSegment(id as any)}
            style={styles.segmented}
          />

          {error ? (
            <EmptyStateCard
              icon="⚠️"
              title="Could not load bookings"
              message={error}
              actionLabel="Retry"
              onAction={refresh}
            />
          ) : null}

          {isLoading ? (
            <View>
              <ChargerCardSkeleton />
              <ChargerCardSkeleton />
              <ChargerCardSkeleton />
            </View>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const charger = data.chargersById[item.chargerId];
                const reviewedRating = reviewedIds[item.id] ?? reviewRatingsByBookingId[item.id];
                const isPast = segment === "past";
                const isCancelled = item.status === "cancelled" || item.status === "declined";
                const primaryAction =
                  segment === "upcoming"
                    ? item.status === "requested" ? "Edit Booking" : undefined
                    : segment === "active"
                    ? "Start Charging"
                    : reviewedRating
                    ? undefined
                    : "Leave Review";

                const secondaryAction =
                  segment === "upcoming"
                    ? "Cancel"
                    : segment === "active"
                    ? "Mark Arrived"
                    : undefined;

                return (
                  <AnimatedListItem index={index}>
                    <View style={[styles.cardWrap, isCancelled && styles.cardCancelled]}>
                      <BookingCard
                        booking={{
                          id: item.id,
                          chargerName: charger?.name || item.chargerId,
                          chargerAddress:
                            charger ? `${charger.suburb}, ${charger.state}` : "Charger location",
                          status: item.status,
                          scheduledAt: item.startTimeIso,
                          durationMinutes: Math.max(
                            30,
                            Math.round(
                              (new Date(item.endTimeIso).getTime() -
                                new Date(item.startTimeIso).getTime()) /
                                (1000 * 60)
                            )
                          ),
                          kwhDelivered: item.estimatedKWh,
                        }}
                        secondaryActionLabel={secondaryAction}
                        onSecondaryAction={
                          segment === "upcoming"
                            ? () => actions.cancelBooking(item.id)
                            : () => actions.markArrived(item.id)
                        }
                        primaryActionLabel={primaryAction}
                        onPrimaryAction={
                          segment === "upcoming" && item.status === "requested"
                            ? () => router.push(`/(app)/chargers/${item.chargerId}` as any)
                            : segment === "active"
                            ? () => actions.startCharging(item.id)
                            : !reviewedRating && segment === "past"
                            ? () => setReviewBooking(item)
                            : undefined
                        }
                      />
                      <BookingTimeline status={item.status} currentStep={item.arrivalSignal} />
                      {isPast && reviewedRating ? (
                        <View style={styles.reviewedRow}>
                          <InfoPill label={`${reviewedRating.toFixed(1)}★ Reviewed`} variant="success" />
                        </View>
                      ) : null}
                    </View>
                  </AnimatedListItem>
                );
              }}
              ListEmptyComponent={
                <EmptyStateCard
                  icon={segment === "past" ? "🧾" : segment === "active" ? "🔋" : "📅"}
                  title={`No ${segment} bookings`}
                  message="When you book a charger, it will appear here."
                />
              }
            />
          )}
        </ScreenContainer>
      </Animated.View>

      <BottomSheet
        visible={Boolean(reviewBooking)}
        onClose={() => setReviewBooking(null)}
        title="Leave Review"
        subtitle={
          reviewBooking
            ? data.chargersById[reviewBooking.chargerId]?.name || `Booking ${reviewBooking.id.slice(0, 6)}`
            : undefined
        }
      >
        <Text style={styles.ratingLabel}>Rating</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)} hitSlop={6}>
              <Text style={[styles.star, star <= rating && styles.starActive]}>
                {star <= rating ? "★" : "☆"}
              </Text>
            </Pressable>
          ))}
          <Text style={styles.ratingText}>{rating}/5</Text>
        </View>
        <InputField
          label="Comment (optional)"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          placeholder="How was your charging experience?"
        />
        <PrimaryCTA label="Submit Review" onPress={handleReviewSubmit} />
      </BottomSheet>

      <Toast
        visible={toastVisible}
        message={toastText}
        tone="info"
        onDismiss={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  segmented: {
    marginVertical: Spacing.md,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  cardWrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  cardCancelled: {
    opacity: 0.55,
  },
  reviewedRow: {
    marginTop: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  star: {
    fontSize: 32,
    color: Colors.border,
  },
  starActive: {
    color: Colors.warning,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
});
