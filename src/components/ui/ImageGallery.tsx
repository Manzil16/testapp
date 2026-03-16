import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Colors, Radius, Spacing } from "@/src/features/shared/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GALLERY_HEIGHT = 240;

interface ImageGalleryProps {
  images: string[];
  height?: number;
  onAddImage?: () => void;
}

export function ImageGallery({
  images,
  height = GALLERY_HEIGHT,
  onAddImage,
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  if (images.length === 0) {
    return (
      <TouchableOpacity
        style={[styles.placeholder, { height }]}
        onPress={onAddImage}
        activeOpacity={0.7}
        disabled={!onAddImage}
      >
        <Text style={styles.placeholderIcon}>📷</Text>
        <Text style={styles.placeholderText}>
          {onAddImage ? "Tap to add photos" : "No photos available"}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        ref={flatListRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={[styles.image, { height }]}
            contentFit="cover"
            transition={200}
          />
        )}
      />
      {images.length > 1 && (
        <View style={styles.pagination}>
          <View style={styles.paginationPill}>
            <Text style={styles.paginationText}>
              {activeIndex + 1} / {images.length}
            </Text>
          </View>
        </View>
      )}
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  image: {
    width: SCREEN_WIDTH,
  },
  placeholder: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  placeholderIcon: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  pagination: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
  },
  paginationPill: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  paginationText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  dots: {
    position: "absolute",
    bottom: Spacing.md,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: {
    backgroundColor: "#FFF",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
