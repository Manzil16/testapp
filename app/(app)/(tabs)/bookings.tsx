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
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import {
  AnimatedListItem,
  BookingCard,
  BookingTimeline,
  BottomSheet,
  CancellationSheet,
  ChargerCardSkeleton,
  EmptyStateCard,
  InfoPill,
  InputField,
  PrimaryCTA,
  PressableScale,
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
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
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

  const handleCancelConfirm = async (reason: string) => {
    if (!cancelBooking) return;
    setIsCancelling(true);
    try {
      await actions.cancelBooking(cancelBooking.id, reason);
      showToast("Booking cancelled.");
    } catch {
      showToast("Failed to cancel booking.");
    } finally {
      setIsCancelling(false);
      setCancelBooking(null);
    }
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

  const getPrimaryActionHandler = (
    item: Booking,
    canStartCharging: boolean,
    isInProgress: boolean,
    reviewedRating: number | undefined,
  ): (() => void) | undefined => {
    if (segment === "upcoming" && item.status === "requested") {
      return () => router.push(`/(app)/chargers/${item.chargerId}` as any);
    }
    if (segment === "active" && canStartCharging) {
      return () => actions.startCharging(item.id);
    }
    if (segment === "active" && isInProgress) {
      return () => actions.endSession(item.id);
    }
    if (segment === "past" && !reviewedRating) {
      return () => setReviewBooking(item);
    }
    return undefined;
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <Text style={Typography.body}>Upcoming, active, and past charging sessions.</Text>

          <SegmentedControl
            segments={[
              { id: "upcoming", label: "Upcoming" },
              { id: "active", label: "Active" },
              { id: "past", label: "Past" },
            ]}
            activeId={segment}
            onChange={(id) => {
              if (id === "upcoming" || id === "active" || id === "past") {
                setSegment(id);
              }
            }}
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
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00BFA5" />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const charger = data.chargersById[item.chargerId];
                const reviewedRating = reviewedIds[item.id] ?? reviewRatingsByBookingId[item.id];
                const isPast = segment === "past";
                const isCancelled = item.status === "cancelled" || item.status === "declined";

                const durationMinutes = Math.max(
                  30,
                  Math.round(
                    (new Date(item.endTimeIso).getTime() -
                      new Date(item.startTimeIso).getTime()) /
                      (1000 * 60)
                  )
                );

                // Only show arrival/charging actions when host has approved
                const isApproved = item.status === "approved";
                const isInProgress = item.status === "active";
                const canMarkArrived = isApproved && item.arrivalSignal === "en_route";
                const canStartCharging = isApproved && item.arrivalSignal === "arrived";

                const primaryAction =
                  segment === "upcoming"
                    ? item.status === "requested" ? "Edit Booking" : undefined
                    : segment === "active"
                    ? canStartCharging
                      ? "Start Charging"
                      : isInProgress
                      ? "End Session"
                      : undefined
                    : reviewedRating
                    ? undefined
                    : "Leave Review";

                const secondaryAction =
                  segment === "upcoming"
                    ? "Cancel"
                    : segment === "active" && canMarkArrived
                    ? "Mark Arrived"
                    : undefined;

                const connectorLabel = charger?.connectors?.map((c) => c.type).join(", ");

                return (
                  <AnimatedListItem index={index}>
                    <PressableScale
                      style={[styles.cardWrap, isCancelled && styles.cardCancelled]}
                      onPress={() => charger && router.push(`/(app)/chargers/${charger.id}` as any)}
                    >
                      <BookingCard
                        booking={{
                          id: item.id,
                          chargerName: charger?.name || "Unknown Charger",
                          chargerAddress:
                            charger
                              ? `${charger.address ? charger.address + ", " : ""}${charger.suburb}, ${charger.state}`
                              : "Location unavailable",
                          status: item.status,
                          scheduledAt: item.startTimeIso,
                          durationMinutes,
                          kwhDelivered: item.estimatedKWh,
                          totalCost: item.totalAmount,
                        }}
                        secondaryActionLabel={secondaryAction}
                        onSecondaryAction={
                          segment === "upcoming"
                            ? () => setCancelBooking(item)
                            : canMarkArrived
                            ? () => actions.markArrived(item.id)
                            : undefined
                        }
                        primaryActionLabel={primaryAction}
                        onPrimaryAction={getPrimaryActionHandler(
                          item,
                          canStartCharging,
                          isInProgress,
                          reviewedRating,
                        )}
                      />

                      {/* Charger details row */}
                      {charger && (
                        <View style={styles.chargerDetailsRow}>
                          {charger.maxPowerKw ? (
                            <View style={styles.detailChip}>
                              <Ionicons name="speedometer-outline" size={12} color={Colors.primary} />
                              <Text style={styles.detailChipText}>{charger.maxPowerKw} kW</Text>
                            </View>
                          ) : null}
                          {connectorLabel ? (
                            <View style={styles.detailChip}>
                              <Ionicons name="hardware-chip-outline" size={12} color={Colors.info} />
                              <Text style={styles.detailChipText}>{connectorLabel}</Text>
                            </View>
                          ) : null}
                          <View style={styles.detailChip}>
                            <Ionicons name="pricetag-outline" size={12} color={Colors.primary} />
                            <Text style={styles.detailChipText}>
                              ${charger.pricingPerKwh.toFixed(2)}/kWh
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Time range */}
                      <View style={styles.timeRangeRow}>
                        <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                        <Text style={styles.timeRangeText}>
                          {new Date(item.startTimeIso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                          {" — "}
                          {new Date(item.endTimeIso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          {durationMinutes >= 60
                            ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60 > 0 ? `${durationMinutes % 60}m` : ""}`
                            : `${durationMinutes}m`}
                        </Text>
                      </View>

                      {/* Note / expiry info */}
                      {item.note ? (
                        <View style={styles.noteRow}>
                          <Ionicons name="chatbubble-ellipses-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.noteText} numberOfLines={2}>{item.note}</Text>
                        </View>
                      ) : null}

                      {/* Cost breakdown for past bookings */}
                      {isPast && item.totalAmount > 0 && (
                        <View style={styles.costBreakdownRow}>
                          <View style={styles.costItem}>
                            <Text style={styles.costLabel}>Energy</Text>
                            <Text style={styles.costValue}>{item.estimatedKWh.toFixed(1)} kWh</Text>
                          </View>
                          <View style={styles.costItem}>
                            <Text style={styles.costLabel}>Rate</Text>
                            <Text style={styles.costValue}>
                              ${charger
                                ? charger.pricingPerKwh.toFixed(2)
                                : item.estimatedKWh > 0
                                ? (item.totalAmount / item.estimatedKWh).toFixed(2)
                                : "—"}/kWh
                            </Text>
                          </View>
                          <View style={styles.costItem}>
                            <Text style={styles.costLabel}>Platform fee</Text>
                            <Text style={styles.costValue}>${item.platformFee.toFixed(2)}</Text>
                          </View>
                          <View style={styles.costItem}>
                            <Text style={styles.costLabelBold}>Total</Text>
                            <Text style={styles.costValueBold}>${item.totalAmount.toFixed(2)}</Text>
                          </View>
                        </View>
                      )}

                      {segment === "active" && !isApproved && !isInProgress && (
                        <View style={styles.pendingNote}>
                          <Ionicons name="time-outline" size={13} color={Colors.warning} />
                          <Text style={styles.pendingNoteText}>Waiting for host to approve your booking</Text>
                        </View>
                      )}
                      <BookingTimeline status={item.status} currentStep={item.arrivalSignal ?? undefined} />
                      {isPast && reviewedRating ? (
                        <View style={styles.reviewedRow}>
                          <InfoPill label={`${reviewedRating.toFixed(1)}★ Reviewed`} variant="success" />
                        </View>
                      ) : null}
                    </PressableScale>
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

      <CancellationSheet
        visible={Boolean(cancelBooking)}
        onClose={() => setCancelBooking(null)}
        onConfirm={handleCancelConfirm}
        loading={isCancelling}
        bookingInfo={
          cancelBooking
            ? {
                chargerName:
                  data.chargersById[cancelBooking.chargerId]?.name || "Charger",
                scheduledAt: cancelBooking.startTimeIso,
              }
            : undefined
        }
      />

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
  chargerDetailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  detailChipText: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  timeRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  timeRangeText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  costBreakdownRow: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
  },
  costItem: {
    flex: 1,
    alignItems: "center",
  },
  costLabel: {
    fontSize: 9,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  costLabelBold: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  costValue: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  costValueBold: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  pendingNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  pendingNoteText: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: "500",
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
