import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors } from "@/src/features/shared/theme";

interface RatingStarsRowProps {
  rating: number;
  /** Total review count */
  count?: number;
  /** Optional short review snippet */
  snippet?: string;
  size?: "sm" | "md";
  style?: ViewStyle;
}

export function RatingStarsRow({
  rating,
  count,
  snippet,
  size = "md",
  style,
}: RatingStarsRowProps) {
  const clampedRating = Math.min(5, Math.max(0, rating));
  const fullStars = Math.floor(clampedRating);
  const hasHalf = clampedRating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  const starSize = size === "sm" ? 11 : 14;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.stars}>
        {Array(fullStars).fill(null).map((_, i) => (
          <Text key={`f${i}`} style={[styles.star, { fontSize: starSize, color: Colors.warning }]}>★</Text>
        ))}
        {hasHalf && (
          <Text style={[styles.star, { fontSize: starSize, color: Colors.warning }]}>½</Text>
        )}
        {Array(emptyStars).fill(null).map((_, i) => (
          <Text key={`e${i}`} style={[styles.star, { fontSize: starSize, color: Colors.border }]}>★</Text>
        ))}
      </View>
      {count !== undefined && (
        <Text style={[styles.count, size === "sm" && styles.countSm]}>
          {clampedRating.toFixed(1)} ({count})
        </Text>
      )}
      {snippet ? (
        <Text style={styles.snippet} numberOfLines={1}>{snippet}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  stars: {
    flexDirection: "row",
    gap: 1,
  },
  star: {
    lineHeight: 16,
  },
  count: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  countSm: {
    fontSize: 11,
  },
  snippet: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: "italic",
    flexShrink: 1,
  },
});
