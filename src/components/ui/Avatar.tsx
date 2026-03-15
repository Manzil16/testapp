import React, { useState } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { Colors } from "@/src/features/shared/theme";

type AvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const AVATAR_PALETTE = [
  "#1DB954", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#06B6D4",
] as const;

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (first + last).toUpperCase();
}

interface AvatarProps {
  uri?: string;
  /** @deprecated Use `uri` instead */
  imageUri?: string;
  name?: string;
  size?: AvatarSize | number;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ uri, imageUri, name, size = "md", style }: AvatarProps) {
  const resolvedUri = uri || imageUri;
  const px = typeof size === "number" ? size : SIZE_MAP[size];
  const [imageLoaded, setImageLoaded] = useState(false);

  const initials = name ? getInitials(name) : "";
  const bgColor = name ? AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length] : Colors.surfaceAlt;

  return (
    <View
      style={[
        styles.container,
        { width: px, height: px, borderRadius: px / 2, backgroundColor: bgColor },
        style,
      ]}
    >
      {resolvedUri ? (
        <Animated.View entering={imageLoaded ? FadeIn.duration(200) : undefined} style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri: resolvedUri }}
            style={styles.image}
            onLoad={() => setImageLoaded(true)}
          />
        </Animated.View>
      ) : initials ? (
        <Text style={[styles.initials, { fontSize: px * 0.38, color: Colors.textInverse }]}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person-circle" size={px * 0.7} color={Colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.border,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  initials: {
    fontWeight: "700",
  },
});
