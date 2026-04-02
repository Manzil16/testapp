import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, SlideOutLeft } from "react-native-reanimated";
import Slider from "@react-native-community/slider";
import {
  EmptyStateCard,
  ImageGallery,
  InfoPill,
  InputField,
  PremiumCard,
  PrimaryCTA,
  ScreenContainer,
  SecondaryButton,
  SectionTitle,
  Typography,
  Colors,
  Radius,
  Spacing,
  Shadows,
} from "@/src/components";
import { useAdminVerify, type PendingChargerWithHost } from "@/src/hooks/useAdminVerify";
import { getDetailImageUrl } from "@/src/services/imageService";
import { useRefresh } from "@/src/hooks";
import { AppConfig } from "@/src/constants/app";

interface RubricState {
  photos: number;
  specs: number;
  location: number;
  access: number;
  pricing: number;
}

function RubricSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.rubricSlider}>
      <View style={styles.rubricLabelRow}>
        <Text style={Typography.body}>{label}</Text>
        <Text style={styles.rubricValue}>{value}/20</Text>
      </View>
      <Slider
        minimumValue={0}
        maximumValue={20}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={Colors.accent}
        maximumTrackTintColor={Colors.border}
        thumbTintColor={Colors.accent}
      />
    </View>
  );
}

function ChargerVerifyCard({
  item,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  item: PendingChargerWithHost;
  onApprove: (chargerId: string, rubric: RubricState, notes: string) => void;
  onReject: (chargerId: string, reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const [rubric, setRubric] = useState<RubricState>({
    photos: 0,
    specs: 0,
    location: 0,
    access: 0,
    pricing: 0,
  });
  const [notes, setNotes] = useState("");

  const totalScore = rubric.photos + rubric.specs + rubric.location + rubric.access + rubric.pricing;
  const allScored = rubric.photos > 0 && rubric.specs > 0 && rubric.location > 0 && rubric.access > 0 && rubric.pricing > 0;
  const scoreQualifies = totalScore >= AppConfig.VERIFICATION.approvedScore;
  const scoreColor = scoreQualifies ? Colors.success : totalScore >= AppConfig.VERIFICATION.flaggedThreshold ? Colors.warning : Colors.error;

  const handleApprove = () => {
    if (!allScored) {
      Alert.alert("Incomplete rubric", "Please score all 5 categories before approving.");
      return;
    }
    onApprove(item.charger.id, rubric, notes);
  };

  const handleReject = () => {
    if (!notes.trim()) {
      Alert.alert("Notes required", "Please provide a reason for rejection.");
      return;
    }
    onReject(item.charger.id, notes);
  };

  return (
    <Animated.View exiting={SlideOutLeft.duration(300)}>
      <PremiumCard style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.hostRow}>
            <View style={styles.hostAvatar}>
              <Text style={styles.hostAvatarText}>
                {item.host.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={Typography.cardTitle}>{item.charger.name}</Text>
              <Text style={Typography.caption}>
                by {item.host.displayName} · {new Date(item.charger.createdAtIso).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Image Gallery */}
        {item.charger.images.length > 0 && (
          <ImageGallery
            images={item.charger.images.map((img) => getDetailImageUrl(img))}
            height={200}
          />
        )}

        {/* Spec Summary */}
        <View style={styles.specRow}>
          <InfoPill label={item.charger.address} />
          <InfoPill label={`${item.charger.maxPowerKw}kW`} variant="primary" />
          <InfoPill
            label={item.charger.connectors.map((c) => c.type).join(", ")}
          />
          <InfoPill
            label={`$${item.charger.pricingPerKwh.toFixed(2)}/kWh`}
            variant="success"
          />
        </View>

        {/* Rubric Scoring */}
        <SectionTitle title="Verification Rubric" topSpacing={Spacing.md} />

        <RubricSlider
          label="Photos quality"
          value={rubric.photos}
          onChange={(v) => setRubric((prev) => ({ ...prev, photos: v }))}
        />
        <RubricSlider
          label="Technical specs"
          value={rubric.specs}
          onChange={(v) => setRubric((prev) => ({ ...prev, specs: v }))}
        />
        <RubricSlider
          label="Location accuracy"
          value={rubric.location}
          onChange={(v) => setRubric((prev) => ({ ...prev, location: v }))}
        />
        <RubricSlider
          label="Access clarity"
          value={rubric.access}
          onChange={(v) => setRubric((prev) => ({ ...prev, access: v }))}
        />
        <RubricSlider
          label="Pricing fairness"
          value={rubric.pricing}
          onChange={(v) => setRubric((prev) => ({ ...prev, pricing: v }))}
        />

        {/* Live Score */}
        <View style={[styles.scoreRow, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            Total: {totalScore}/100
          </Text>
          <Text style={[Typography.caption, { color: scoreColor }]}>
            {scoreQualifies ? "Approved range" : totalScore >= AppConfig.VERIFICATION.flaggedThreshold ? "Needs review" : "Below threshold"}
          </Text>
        </View>

        {/* Notes */}
        <InputField
          label={totalScore < 85 ? "Notes (required)" : "Notes (optional)"}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add review notes..."
          multiline
        />

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <SecondaryButton
            label="Reject"
            onPress={handleReject}
            loading={isRejecting}
            danger
            style={styles.actionHalf}
          />
          <PrimaryCTA
            label="Approve"
            onPress={handleApprove}
            loading={isApproving}
            disabled={!allScored || !scoreQualifies}
            style={styles.actionHalf}
          />
        </View>
        {allScored && !scoreQualifies && (
          <Text style={styles.approveBlockedNote}>
            Score must reach {AppConfig.VERIFICATION.approvedScore}/100 to approve. Current score: {totalScore}/100.
          </Text>
        )}
      </PremiumCard>
    </Animated.View>
  );
}

export default function AdminVerifyScreen() {
  const {
    pendingChargers,
    isLoading,
    refetch,
    approveCharger,
    rejectCharger,
    isApproving,
    isRejecting,
  } = useAdminVerify();
  const { refreshing, onRefresh } = useRefresh(refetch);

  const handleApprove = useCallback(
    async (chargerId: string, rubric: RubricState, notes: string) => {
      await approveCharger({
        chargerId,
        rubric: {
          photoQuality: rubric.photos,
          plugVerified: rubric.specs as any,
          locationAccuracy: rubric.location,
          hostResponse: rubric.access,
          adminReview: rubric.pricing as any,
        },
        notes,
      });
    },
    [approveCharger]
  );

  const handleReject = useCallback(
    async (chargerId: string, reason: string) => {
      await rejectCharger({ chargerId, reason });
    },
    [rejectCharger]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScreenContainer>
        <Text style={Typography.pageTitle}>Charger Verification</Text>
        <Text style={Typography.body}>
          {pendingChargers.length} charger{pendingChargers.length !== 1 ? "s" : ""} awaiting review
        </Text>

        {pendingChargers.length === 0 && !isLoading ? (
          <EmptyStateCard
            icon="✅"
            title="No chargers awaiting review"
            message="All charger submissions have been reviewed."
          />
        ) : (
          <FlatList
            data={pendingChargers}
            keyExtractor={(item) => item.charger.id}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 80).duration(260)}>
                <ChargerVerifyCard
                  item={item}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isApproving={isApproving}
                  isRejecting={isRejecting}
                />
              </Animated.View>
            )}
          />
        )}
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
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    marginBottom: Spacing.md,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  hostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  hostAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textInverse,
  },
  specRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  rubricSlider: {
    marginBottom: Spacing.sm,
  },
  rubricLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  rubricValue: {
    ...Typography.cardTitle,
    color: Colors.accent,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginVertical: Spacing.md,
    borderWidth: 2,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionHalf: {
    flex: 1,
  },
  approveBlockedNote: {
    ...Typography.caption,
    color: Colors.warning,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
