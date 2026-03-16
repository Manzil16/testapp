import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  FadeOutUp,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing } from "@/src/features/shared/theme";

// Simple polling-based connectivity check
function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch("https://httpbin.org/get", {
          method: "HEAD",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (mounted) setIsConnected(true);
      } catch {
        if (mounted) setIsConnected(false);
      }
    }

    check();
    const interval = setInterval(check, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return isConnected;
}

export function NetworkBanner() {
  const isConnected = useNetworkStatus();

  if (isConnected) return null;

  return (
    <Animated.View entering={FadeInUp.duration(300)} exiting={FadeOutUp.duration(300)}>
      <View style={styles.banner}>
        <Ionicons name="cloud-offline" size={16} color={Colors.textPrimary} />
        <Text style={styles.text}>No internet connection</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.error,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.sm,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
    fontFamily: "DMSans_600SemiBold",
  },
});
