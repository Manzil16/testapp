import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Typography, Spacing, Radius, Shadows } from "@/src/features/shared/theme";
import { ensurePublicUrl } from "@/src/services/imageService";

const CARD_WIDTH = 200;
const IMAGE_HEIGHT = 120;

interface NearbyChargerCardProps {
  name: string;
  suburb: string;
  powerKw: number;
  pricePerKwh: number;
  distanceLabel?: string;
  isNearest?: boolean;
  images?: string[];
  connectorTypes?: string[];
  onPress: () => void;
}

export function NearbyChargerCard({
  name,
  suburb,
  powerKw,
  pricePerKwh,
  distanceLabel,
  isNearest,
  images,
  connectorTypes,
  onPress,
}: NearbyChargerCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const hasImages = images && images.length > 0;
  const multipleImages = images && images.length > 1;

  return (
    <TouchableOpacity
      style={[styles.container, isNearest && styles.nearestBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Image area */}
      <View style={styles.imageWrap}>
        {hasImages ? (
          <>
            <FlatList
              ref={flatListRef}
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
                setActiveIndex(index);
              }}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: ensurePublicUrl(item) }}
                  style={styles.image}
                  resizeMode="cover"
                />
              )}
            />
            {multipleImages && (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === activeIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="flash" size={28} color={Colors.primary} />
          </View>
        )}

        {/* Nearest badge */}
        {isNearest && (
          <View style={styles.nearestBadge}>
            <Ionicons name="navigate" size={9} color={Colors.textInverse} />
            <Text style={styles.nearestText}>Nearest</Text>
          </View>
        )}

        {/* Distance chip */}
        {distanceLabel && (
          <View style={styles.distanceChip}>
            <Ionicons name="location" size={10} color="#FFF" />
            <Text style={styles.distanceText}>{distanceLabel}</Text>
          </View>
        )}
      </View>

      {/* Card body */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{suburb}</Text>

        {/* Connector types */}
        {connectorTypes && connectorTypes.length > 0 && (
          <View style={styles.connectorRow}>
            {connectorTypes.slice(0, 2).map((type) => (
              <View key={type} style={styles.connectorPill}>
                <Text style={styles.connectorText}>{type}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.power}>{powerKw} kW</Text>
          <Text style={styles.price}>${pricePerKwh.toFixed(2)}/kWh</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginRight: Spacing.md,
    overflow: "hidden",
    ...Shadows.card,
  },
  nearestBorder: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },

  // Image area
  imageWrap: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: Colors.surfaceAlt,
    position: "relative",
  },
  image: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
  },
  imagePlaceholder: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    position: "absolute",
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: {
    backgroundColor: "#FFF",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nearestBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.primary,
    borderBottomRightRadius: Radius.md,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  nearestText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textInverse,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  distanceChip: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFF",
  },

  // Body
  body: {
    padding: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 1,
  },
  meta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  connectorRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: Spacing.xs,
  },
  connectorPill: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  connectorText: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.primary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  power: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  price: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
});
