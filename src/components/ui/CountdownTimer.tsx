import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Colors, Typography, Spacing } from "@/src/features/shared/theme";

interface CountdownTimerProps {
  targetIso: string;
  label?: string;
  onExpired?: () => void;
  style?: ViewStyle;
}

export function CountdownTimer({
  targetIso,
  label,
  onExpired,
  style,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;

    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000)
      );
      setRemaining(diff);
      if (diff <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso, onExpired]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  const isUrgent = remaining > 0 && remaining <= 120;
  const isWarning = remaining > 120 && remaining <= 600;

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          styles.timer,
          isWarning && styles.timerWarning,
          isUrgent && styles.timerUrgent,
        ]}
      >
        {remaining <= 0
          ? "Now"
          : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}
      </Text>
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  timer: {
    ...Typography.heroNumber,
    fontSize: 36,
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
  timerWarning: {
    color: Colors.warning,
  },
  timerUrgent: {
    color: Colors.error,
  },
  label: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
});
