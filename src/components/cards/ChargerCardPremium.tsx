import React, { useMemo, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Colors, Radius, Shadows, Spacing } from "@/src/features/shared/theme";
import { ensurePublicUrl } from "@/src/services/imageService";
import { InfoPill } from "../ui/InfoPill";
import { RatingStarsRow } from "../ui/RatingStarsRow";
import { TrustBadge, TrustBadgeType } from "../ui/TrustBadge";

export interface ChargerCardData {
  id: string;
  name: string;
  address: string;
  /** kW */
  powerKw: number;
  connectorTypes: string[];
  pricePerKwh: number;
  /** 0–5 */
  rating?: number;
  reviewCount?: number;
  /** URI string or require() */
  imageSource?: string | number;
  available?: boolean;
  badge?: TrustBadgeType;
  /** Distance from user in km */
  distanceKm?: number;
}

interface ChargerCardPremiumProps {
  charger: ChargerCardData;
  onPress: () => void;
  style?: ViewStyle;
  /** Compact variant — no image, smaller layout for list views */
  compact?: boolean;
}

export function ChargerCardPremium({
  charger,
  onPress,
  style,
  compact = false,
}: ChargerCardPremiumProps) {
  const {
    name,
    address,
    powerKw,
    connectorTypes,
    pricePerKwh,
    rating,
    reviewCount,
    imageSource,
    available = true,
    badge,
    distanceKm,
  } = charger;

  const [imageError, setImageError] = useState(false);
  const normalizedImage = useMemo(() => {
    if (!imageSource || imageError) return null;
    if (typeof imageSource === "string") return ensurePublicUrl(imageSource);
    return imageSource;
  }, [imageSource, imageError]);
  const resolvedImage = normalizedImage;

  if (__DEV__ && resolvedImage && typeof resolvedImage === "string") {
    console.log("[ChargerCard] rendering image URI:", resolvedImage);
  }

  if (compact) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.compactCard, style]}>
        <View style={styles.compactLeft}>
          {resolvedImage ? (
            <Image
              source={typeof resolvedImage === "string" ? { uri: resolvedImage } : resolvedImage}
              style={styles.compactImageThumb}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.compactAvatar, { backgroundColor: available ? Colors.primaryLight : Colors.surfaceAlt }]}>
              <Text style={styles.compactAvatarIcon}>⚡</Text>
            </View>
          )}
        </View>
        <View style={styles.compactBody}>
          <View style={styles.compactHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.price}>${pricePerKwh.toFixed(2)}<Text style={styles.priceUnit}>/kWh</Text></Text>
          </View>
          <Text style={styles.address} numberOfLines={1}>{address}</Text>
          <View style={styles.pillRow}>
            <InfoPill label={`${powerKw}kW`} variant="primary" />
            {connectorTypes.slice(0, 2).map((c) => (
              <InfoPill key={c} label={c} style={styles.pillGap} />
            ))}
            {!available && <InfoPill label="Unavailable" variant="error" style={styles.pillGap} />}
          </View>
        </View>
        {distanceKm !== undefined && (
          <Text style={styles.distance}>{distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)}m` : `${distanceKm.toFixed(1)}km`}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.card, style]}>
      {/* Photo area */}
      <View style={styles.imageContainer}>
        {resolvedImage ? (
          <Image
            source={typeof resolvedImage === "string" ? { uri: resolvedImage } : resolvedImage}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderIcon}>⚡</Text>
          </View>
        )}

        {/* Availability badge overlay */}
        <View style={[styles.availabilityDot, { backgroundColor: available ? Colors.success : Colors.error }]} />

        {/* Distance chip */}
        {distanceKm !== undefined && (
          <View style={styles.distanceChip}>
            <Text style={styles.distanceChipText}>
              {distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)}m` : `${distanceKm.toFixed(1)}km`}
            </Text>
          </View>
        )}
      </View>

      {/* Card body */}
      <View style={styles.body}>
        {/* Trust badge */}
        {badge && <TrustBadge type={badge} style={styles.trustBadge} />}

        {/* Name + price row */}
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.price}>
            ${pricePerKwh.toFixed(2)}
            <Text style={styles.priceUnit}>/kWh</Text>
          </Text>
        </View>

        {/* Address */}
        <Text style={styles.address} numberOfLines={1}>{address}</Text>

        {/* Rating */}
        {rating !== undefined && (
          <RatingStarsRow
            rating={rating}
            count={reviewCount}
            size="sm"
            style={styles.rating}
          />
        )}

        {/* Connector + power pills */}
        <View style={styles.pillRow}>
          <InfoPill label={`${powerKw}kW`} variant="primary" />
          {connectorTypes.slice(0, 3).map((c) => (
            <InfoPill key={c} label={c} style={styles.pillGap} />
          ))}
          {!available && (
            <InfoPill label="Unavailable" variant="error" style={styles.pillGap} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Full card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    overflow: "hidden",
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 160,
  },
  imagePlaceholder: {
    width: "100%",
    height: 160,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderIcon: {
    fontSize: 48,
  },
  availabilityDot: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  distanceChip: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  distanceChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textInverse,
  },
  body: {
    padding: Spacing.cardPadding,
  },
  trustBadge: {
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  price: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: "400",
    color: Colors.textMuted,
  },
  address: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  rating: {
    marginTop: 6,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  pillGap: {
    // handled by gap
  },

  // Compact card
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  compactLeft: {
    marginRight: Spacing.md,
  },
  compactImageThumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
  },
  compactAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  compactAvatarIcon: {
    fontSize: 22,
  },
  compactBody: {
    flex: 1,
  },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  distance: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textMuted,
    marginLeft: Spacing.sm,
  },
});
