import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  snapRatio?: number;
  disableBackdropClose?: boolean;
  containerStyle?: ViewStyle;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;

export function BottomSheet({
  visible,
  onClose,
  children,
  title,
  subtitle,
  snapRatio = 0.62,
  disableBackdropClose = false,
  containerStyle,
}: BottomSheetProps) {
  const [rendered, setRendered] = useState(visible);
  const sheetHeight = useMemo(
    () => Math.max(240, Math.min(SCREEN_HEIGHT * snapRatio, SCREEN_HEIGHT - 80)),
    [snapRatio]
  );

  const translateY = useSharedValue(sheetHeight);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.value = withSpring(0, { damping: 22, stiffness: 230 });
      return;
    }

    if (rendered) {
      translateY.value = withTiming(sheetHeight, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setRendered)(false);
        }
      });
    }
  }, [rendered, sheetHeight, translateY, visible]);

  const dragGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd(() => {
      if (translateY.value > sheetHeight * 0.28) {
        translateY.value = withTiming(sheetHeight, { duration: 180 }, (finished) => {
          if (finished) {
            runOnJS(onClose)();
          }
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, sheetHeight], [1, 0]),
  }));

  if (!rendered) {
    return null;
  }

  return (
    <Modal transparent visible={rendered} animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={styles.backdropPressable}
            onPress={disableBackdropClose ? undefined : onClose}
          />
        </Animated.View>

        <GestureDetector gesture={dragGesture}>
          <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle, containerStyle]}>
            <View style={styles.handle} />
            {(title || subtitle) && (
              <View style={styles.header}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
            )}
            <View style={styles.content}>{children}</View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    ...Shadows.modal,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  header: {
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.sectionTitle,
  },
  subtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
});
