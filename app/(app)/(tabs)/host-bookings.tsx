import { useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  AnimatedListItem,
  Avatar,
  BottomSheet,
  ChargerCardSkeleton,
  EmptyStateCard,
  InfoPill,
  InputField,
  PressableScale,
  PrimaryCTA,
  ScreenContainer,
  SegmentedControl,
  Typography,
  Colors,
  Radius,
  Shadows,
  Spacing,
} from "@/src/components";
import { useAuth } from "@/src/features/auth/auth-context";
import { type HostBookingSegment, useHostBookings, useEntranceAnimation, useRefresh } from "@/src/hooks";

const SEGMENT_EMPTY: Record<HostBookingSegment, { icon: string; title: string; message: string }> = {
  pending: { icon: "time-outline", title: "No pending requests", message: "New booking requests from drivers will appear here." },
  active: { icon: "flash-outline", title: "No active sessions", message: "Active charging sessions will show here." },
  completed: { icon: "checkmark-circle-outline", title: "No completed bookings", message: "Completed sessions will be listed here." },
  declined: { icon: "close-circle-outline", title: "No declined bookings", message: "Declined or cancelled bookings appear here." },
};

export default function HostBookingsTabScreen() {
  const { user, profile } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const userId = useMemo(
    () => user?.id,
    [user?.id]
  );

  const { data, isLoading, error, refresh, actions } = useHostBookings(userId);
  const { refreshing, onRefresh } = useRefresh(refresh);
  const [segment, setSegment] = useState<HostBookingSegment>("pending");
  const [completeBooking, setCompleteBooking] = useState<import("@/src/features/bookings").Booking | null>(null);
  const [actualKwhInput, setActualKwhInput] = useState("");

  const segmentData = data.grouped[segment];
  const pendingCount = data.grouped.pending.length;

  if (!profile?.isHost) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          {/* Header */}
          <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Bookings</Text>
              <Text style={styles.pageSubtitle}>Manage incoming requests and sessions</Text>
            </View>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <SegmentedControl
              segments={[
                { id: "pending", label: "Pending" },
                { id: "active", label: "Active" },
                { id: "completed", label: "Done" },
                { id: "declined", label: "Declined" },
              ]}
              activeId={segment}
              onChange={(id) => setSegment(id as HostBookingSegment)}
              style={styles.segmented}
            />
          </Animated.View>

          {error ? (
            <EmptyStateCard
              icon="⚠️"
              title="Unable to load bookings"
              message={error}
              actionLabel="Retry"
              onAction={refresh}
            />
          ) : null}

          {isLoading ? (
            <View style={styles.skeletons}>
              <ChargerCardSkeleton />
              <ChargerCardSkeleton />
            </View>
          ) : (
            <FlatList
              data={segmentData}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00BFA5" />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => {
                const charger = data.chargersById[item.chargerId];
                const driverProfile = data.driversById?.[item.driverUserId];
                const isPending = segment === "pending";
                const isActive = segment === "active";
                const isCompleted = segment === "completed" || segment === "declined";

                const scheduledDate = new Date(item.startTimeIso);
                const durationMin = Math.max(
                  30,
                  Math.round(
                    (new Date(item.endTimeIso).getTime() - scheduledDate.getTime()) / (1000 * 60)
                  )
                );

                return (
                  <AnimatedListItem index={index}>
                    <View style={[styles.bookingCard, isCompleted && styles.bookingCardFaded]}>
                      {/* Driver row */}
                      <View style={styles.driverRow}>
                        <Avatar
                          uri={driverProfile?.avatarUrl}
                          name={driverProfile?.displayName || "Driver"}
                          size="sm"
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.driverName}>
                            {driverProfile?.displayName || item.driverUserId.slice(0, 8)}
                          </Text>
                          <Text style={styles.bookingTime}>
                            {scheduledDate.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            · {scheduledDate.toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <InfoPill
                          label={item.status.replace("_", " ")}
                          variant={
                            isPending ? "warning" : isActive ? "primary" : segment === "completed" ? "success" : "error"
                          }
                        />
                      </View>

                      {/* Charger & details */}
                      <View style={styles.detailsRow}>
                        <View style={styles.detailItem}>
                          <Ionicons name="flash-outline" size={14} color={Colors.textMuted} />
                          <Text style={styles.detailText}>
                            {charger?.name || "Charger"}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Ionicons name="battery-charging-outline" size={14} color={Colors.textMuted} />
                          <Text style={styles.detailText}>{item.estimatedKWh} kWh</Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                          <Text style={styles.detailText}>{durationMin} min</Text>
                        </View>
                      </View>

                      {charger && (
                        <Text style={styles.chargerAddress}>
                          {charger.suburb}, {charger.state}
                        </Text>
                      )}

                      {/* Action buttons */}
                      {(isPending || isActive) && (
                        <View style={styles.actionRow}>
                          {isPending && (
                            <>
                              <PressableScale
                                onPress={() =>
                                  Alert.alert(
                                    "Decline Booking?",
                                    "The driver will be notified and the booking will be cancelled.",
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      {
                                        text: "Decline",
                                        style: "destructive",
                                        onPress: () => actions.declineBooking(item),
                                      },
                                    ]
                                  )
                                }
                                style={styles.declineBtn}
                              >
                                <Ionicons name="close" size={16} color={Colors.error} />
                                <Text style={styles.declineBtnText}>Decline</Text>
                              </PressableScale>
                              <PressableScale
                                onPress={() =>
                                  Alert.alert(
                                    "Approve Booking?",
                                    "This will place an authorization hold on the driver's card and notify them. Continue?",
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      {
                                        text: "Approve",
                                        onPress: () => actions.approveBooking(item),
                                      },
                                    ]
                                  )
                                }
                                style={styles.approveBtn}
                              >
                                <Ionicons name="checkmark" size={16} color={Colors.textInverse} />
                                <Text style={styles.approveBtnText}>Approve</Text>
                              </PressableScale>
                            </>
                          )}
                          {isActive && item.status === "active" && (
                            <PressableScale
                              onPress={() => {
                                setActualKwhInput(String(item.estimatedKWh ?? ""));
                                setCompleteBooking(item);
                              }}
                              style={styles.completeBtn}
                            >
                              <Ionicons name="checkmark-done" size={16} color={Colors.textInverse} />
                              <Text style={styles.completeBtnText}>Mark Complete</Text>
                            </PressableScale>
                          )}
                          {isActive && item.status === "approved" && (
                            <View style={styles.waitingNote}>
                              <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                              <Text style={styles.waitingNoteText}>Waiting for driver to arrive</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </AnimatedListItem>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name={SEGMENT_EMPTY[segment].icon as any}
                    size={48}
                    color={Colors.textMuted}
                    style={{ marginBottom: Spacing.md }}
                  />
                  <Text style={styles.emptyTitle}>{SEGMENT_EMPTY[segment].title}</Text>
                  <Text style={styles.emptyMessage}>{SEGMENT_EMPTY[segment].message}</Text>
                </View>
              }
            />
          )}
        </ScreenContainer>
      </Animated.View>
      <BottomSheet
        visible={Boolean(completeBooking)}
        onClose={() => setCompleteBooking(null)}
        title="Confirm session complete"
        subtitle={completeBooking ? `${data.chargersById[completeBooking.chargerId]?.name ?? "Charger"} · Est. ${completeBooking.estimatedKWh} kWh` : undefined}
      >
        <InputField
          label="Actual kWh delivered"
          value={actualKwhInput}
          onChangeText={setActualKwhInput}
          keyboardType="decimal-pad"
          placeholder={String(completeBooking?.estimatedKWh ?? "")}
          hint="Driver will be billed for this amount"
        />
        <PrimaryCTA
          label="Finalise & capture payment"
          onPress={() => {
            if (!completeBooking) return;
            const kwh = parseFloat(actualKwhInput);
            if (isNaN(kwh) || kwh <= 0) {
              Alert.alert("Invalid kWh", "Please enter a valid kWh value greater than 0.");
              return;
            }
            actions.markCompleted(completeBooking, kwh);
            setCompleteBooking(null);
            setActualKwhInput("");
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: Colors.error,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  segmented: {
    marginBottom: Spacing.lg,
  },
  skeletons: {
    gap: Spacing.sm,
  },
  listContent: {
    paddingBottom: Spacing.xxxl + 20,
  },

  // Booking card
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  bookingCardFaded: {
    opacity: 0.65,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  driverName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  bookingTime: {
    fontSize: 12,
    fontWeight: "400",
    color: Colors.textMuted,
    marginTop: 1,
  },

  // Details
  detailsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  chargerAddress: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },

  // Actions
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorLight,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.error,
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    ...Shadows.button,
  },
  approveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textInverse,
  },
  completeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    ...Shadows.button,
  },
  completeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textInverse,
  },

  waitingNote: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  waitingNoteText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  // Empty
  emptyWrap: {
    alignItems: "center",
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    marginBottom: Spacing.xs,
  },
  emptyMessage: {
    ...Typography.body,
    textAlign: "center",
  },
});
