import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AnimatedListItem,
  Avatar,
  BottomSheet,
  InfoPill,
  InputField,
  PressableScale,
  PrimaryCTA,
  ScreenContainer,
} from "@/src/components";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";
import { useAuth } from "@/src/features/auth/auth-context";
import {
  listVerificationQueue,
  reviewVerificationRequest,
} from "@/src/features/verification/verification.repository";
import type { VerificationRequest, VerificationStatus } from "@/src/features/verification/verification.types";
import { listChargers, updateChargerStatus } from "@/src/features/chargers/charger.repository";
import type { Charger, ChargerStatus } from "@/src/features/chargers/charger.types";
import { createNotification } from "@/src/features/notifications/notification.repository";
import { useEntranceAnimation, useRefresh } from "@/src/hooks";

export default function AdminVerifyTabScreen() {
  const { user } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const queryClient = useQueryClient();
  const reviewerUserId = user?.id;

  const [selected, setSelected] = useState<VerificationRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<VerificationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ["verifications", "queue"],
    queryFn: listVerificationQueue,
  });

  const chargersQuery = useQuery({
    queryKey: ["chargers", "all"],
    queryFn: () => listChargers(),
  });

  const queue = queueQuery.data ?? [];
  const chargersById = useMemo(() => {
    const map: Record<string, Charger> = {};
    for (const c of chargersQuery.data ?? []) map[c.id] = c;
    return map;
  }, [chargersQuery.data]);

  const isLoading = queueQuery.isLoading || chargersQuery.isLoading;

  const refresh = async () => {
    await Promise.all([queueQuery.refetch(), chargersQuery.refetch()]);
  };
  const { refreshing, onRefresh } = useRefresh(refresh);

  const handleDecision = async (
    request: VerificationRequest,
    status: VerificationStatus,
    reasonNote?: string
  ) => {
    if (!reviewerUserId) return;

    try {
      setBusyId(request.id);
      setError(null);

      const note = reasonNote || `Admin decision: ${status}`;

      await reviewVerificationRequest({
        requestId: request.id,
        reviewerUserId,
        status,
        note,
      });

      const chargerStatus: ChargerStatus =
        status === "approved" ? "approved" : "rejected";

      await updateChargerStatus(request.chargerId, chargerStatus, status === "approved" ? 92 : 20);

      try {
        await createNotification({
          userId: request.hostUserId,
          type: "verification",
          title: `Charger ${status === "approved" ? "Approved" : "Rejected"}`,
          body:
            status === "rejected" && note
              ? `Your charger was rejected: ${note}`
              : `Your charger verification request was ${status}.`,
          metadata: {
            verificationRequestId: request.id,
            chargerId: request.chargerId,
          },
        });
      } catch {
        // Notification delivery should not block decisions
      }

      queryClient.invalidateQueries({ queryKey: ["verifications"] });
      queryClient.invalidateQueries({ queryKey: ["chargers"] });

      if (selected?.id === request.id) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process decision.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Animated.View style={[{ flex: 1 }, entranceStyle]}>
        <ScreenContainer scrollable={false}>
          <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Verification</Text>
              <Text style={styles.pageSubtitle}>Review host charger submissions</Text>
            </View>
            {queue.length > 0 && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>{queue.length}</Text>
              </View>
            )}
          </Animated.View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <FlatList
            data={queue}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const charger = chargersById[item.chargerId];
              const connectorTypes = charger?.connectors.map((c) => c.type).join(", ") || "Unknown";
              const isBusy = busyId === item.id;

              return (
                <AnimatedListItem index={index}>
                  <PressableScale style={styles.card} onPress={() => setSelected(item)}>
                    <View style={styles.cardAccent} />
                    <View style={styles.cardBody}>
                      <View style={styles.cardTop}>
                        <View style={styles.chargerIconCircle}>
                          <Ionicons name="flash" size={18} color={Colors.warning} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.chargerName} numberOfLines={1}>
                            {charger?.name || item.chargerId}
                          </Text>
                          {charger && (
                            <Text style={styles.chargerLocation}>
                              {charger.suburb}, {charger.state}
                            </Text>
                          )}
                        </View>
                        <InfoPill label="Pending" variant="warning" />
                      </View>

                      <View style={styles.specsRow}>
                        {charger && (
                          <View style={styles.specItem}>
                            <Ionicons name="speedometer-outline" size={13} color={Colors.textMuted} />
                            <Text style={styles.specText}>{charger.maxPowerKw} kW</Text>
                          </View>
                        )}
                        <View style={styles.specItem}>
                          <Ionicons name="hardware-chip-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.specText}>{connectorTypes}</Text>
                        </View>
                        <View style={styles.specItem}>
                          <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.specText}>
                            {new Date(item.createdAtIso).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.hostRow}>
                        <Avatar name={item.hostUserId.slice(0, 8)} size="sm" />
                        <Text style={styles.hostId}>Host: {item.hostUserId.slice(0, 12)}</Text>
                      </View>

                      <View style={styles.actionRow}>
                        <PressableScale
                          onPress={() => {
                            setRejectTarget(item);
                            setRejectReason("");
                          }}
                          style={styles.rejectBtn}
                          disabled={isBusy}
                        >
                          <Ionicons name="close" size={16} color={Colors.error} />
                          <Text style={styles.rejectBtnText}>Reject</Text>
                        </PressableScale>
                        <PressableScale
                          onPress={() => handleDecision(item, "approved")}
                          style={styles.approveBtn}
                          disabled={isBusy}
                        >
                          <Ionicons name="checkmark" size={16} color="#FFF" />
                          <Text style={styles.approveBtnText}>
                            {isBusy ? "..." : "Approve"}
                          </Text>
                        </PressableScale>
                      </View>
                    </View>
                  </PressableScale>
                </AnimatedListItem>
              );
            }}
            ListEmptyComponent={
              isLoading ? null : (
                <View style={styles.emptyWrap}>
                  <Ionicons name="shield-checkmark" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>All caught up</Text>
                  <Text style={styles.emptyMessage}>No pending verification requests right now.</Text>
                </View>
              )
            }
          />
        </ScreenContainer>
      </Animated.View>

      <BottomSheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Verification Detail"
      >
        {selected ? (
          <View>
            <Text style={styles.sheetTitle}>{chargersById[selected.chargerId]?.name || selected.chargerId}</Text>
            <Text style={styles.sheetMeta}>Host: {selected.hostUserId}</Text>
            <Text style={styles.sheetMeta}>Note: {selected.note || "None"}</Text>
            <Text style={styles.sheetMeta}>
              Submitted: {new Date(selected.createdAtIso).toLocaleString()}
            </Text>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject Charger"
        subtitle="Provide a reason visible to the host"
      >
        <InputField
          label="Rejection Reason"
          value={rejectReason}
          onChangeText={setRejectReason}
          multiline
          numberOfLines={3}
        />
        <PrimaryCTA
          label="Confirm Rejection"
          onPress={async () => {
            if (!rejectTarget) return;
            await handleDecision(
              rejectTarget,
              "rejected",
              rejectReason.trim() || "Rejected by admin"
            );
            setRejectTarget(null);
            setRejectReason("");
          }}
          disabled={busyId === rejectTarget?.id}
          variant="danger"
          style={{ marginTop: Spacing.md }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg },
  pageTitle: { fontSize: 28, fontWeight: "800", color: Colors.textPrimary, letterSpacing: -0.5 },
  pageSubtitle: { ...Typography.caption, marginTop: 2 },
  queueBadge: { backgroundColor: Colors.warning, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  queueBadgeText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, backgroundColor: Colors.errorLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { ...Typography.caption, color: Colors.error, flex: 1 },
  listContent: { paddingBottom: Spacing.xxxl + 20 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, marginBottom: Spacing.md, overflow: "hidden", ...Shadows.card },
  cardAccent: { height: 3, backgroundColor: Colors.warning },
  cardBody: { padding: Spacing.lg },
  cardTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  chargerIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.warningLight, alignItems: "center", justifyContent: "center" },
  chargerName: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary },
  chargerLocation: { ...Typography.caption, marginTop: 1 },
  specsRow: { flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  specItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  specText: { fontSize: 12, fontWeight: "500", color: Colors.textSecondary },
  hostRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md },
  hostId: { ...Typography.caption, color: Colors.textSecondary },
  actionRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: Colors.errorLight },
  rejectBtnText: { fontSize: 14, fontWeight: "600", color: Colors.error },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: Colors.primary, ...Shadows.button },
  approveBtnText: { fontSize: 14, fontWeight: "600", color: "#FFF" },
  emptyWrap: { alignItems: "center", paddingVertical: Spacing.xxxl },
  emptyTitle: { ...Typography.sectionTitle, marginTop: Spacing.md },
  emptyMessage: { ...Typography.body, textAlign: "center", marginTop: Spacing.xs },
  sheetTitle: { ...Typography.sectionTitle },
  sheetMeta: { ...Typography.body, marginTop: Spacing.xs },
});
