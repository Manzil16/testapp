import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { Colors, Typography, Spacing, Radius } from "@/src/features/shared/theme";

interface AvailabilityBarProps {
  chargerId: string;
  date?: string; // ISO date (YYYY-MM-DD), defaults to today
  /** First hour shown on the bar (0–23). */
  startHour?: number;
  /** Last hour shown on the bar (1–24). */
  endHour?: number;
}

interface SlotBooking {
  start_time: string;
  end_time: string;
}

/**
 * Continuous, time-accurate availability strip.
 *
 * Bookings are positioned proportionally to their actual start/end times, so a
 * 22-minute booking that crosses two hours renders as one narrow segment that
 * visually crosses the boundary — not as two whole-hour cells.
 */
export function AvailabilityBar({
  chargerId,
  date,
  startHour = 6,
  endHour = 22,
}: AvailabilityBarProps) {
  const targetDate = date ?? new Date().toISOString().split("T")[0];
  const totalMinutes = (endHour - startHour) * 60;

  const { data: bookings } = useQuery({
    queryKey: ["charger-availability", chargerId, targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("start_time, end_time")
        .eq("charger_id", chargerId)
        .in("status", ["approved", "active", "requested"])
        .gte("end_time", `${targetDate}T${String(startHour).padStart(2, "0")}:00:00`)
        .lte("start_time", `${targetDate}T${String(endHour).padStart(2, "0")}:00:00`);
      if (error) throw error;
      return (data ?? []) as SlotBooking[];
    },
    refetchInterval: 30_000,
  });

  const dayStart = useMemo(
    () => new Date(`${targetDate}T${String(startHour).padStart(2, "0")}:00:00`),
    [targetDate, startHour]
  );
  const dayEnd = useMemo(
    () => new Date(`${targetDate}T${String(endHour).padStart(2, "0")}:00:00`),
    [targetDate, endHour]
  );

  const now = new Date();
  const isToday = targetDate === now.toISOString().split("T")[0];

  const minutesFrom = (target: Date) =>
    Math.max(0, Math.min(totalMinutes, (target.getTime() - dayStart.getTime()) / 60000));

  const pastPercent = isToday
    ? (minutesFrom(now) / totalMinutes) * 100
    : now > dayEnd
    ? 100
    : 0;

  const nowPercent =
    isToday && now >= dayStart && now <= dayEnd
      ? (minutesFrom(now) / totalMinutes) * 100
      : null;

  const bookedSegments = useMemo(() => {
    return (bookings ?? [])
      .map((b) => {
        const segStart = new Date(b.start_time);
        const segEnd = new Date(b.end_time);
        const startMin = minutesFrom(segStart);
        const endMin = minutesFrom(segEnd);
        const widthMin = Math.max(0, endMin - startMin);
        if (widthMin <= 0) return null;
        return {
          left: (startMin / totalMinutes) * 100,
          width: (widthMin / totalMinutes) * 100,
        };
      })
      .filter((s): s is { left: number; width: number } => s !== null);
  }, [bookings, dayStart, totalMinutes]);

  const hourTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let h = startHour + 2; h < endHour; h += 2) {
      ticks.push(((h - startHour) * 60 / totalMinutes) * 100);
    }
    return ticks;
  }, [startHour, endHour, totalMinutes]);

  return (
    <View style={styles.container}>
      <View style={styles.barTrack}>
        {pastPercent > 0 ? (
          <View style={[styles.pastOverlay, { width: `${pastPercent}%` }]} />
        ) : null}

        {hourTicks.map((leftPct, idx) => (
          <View key={`tick-${idx}`} style={[styles.hourTick, { left: `${leftPct}%` }]} />
        ))}

        {bookedSegments.map((seg, idx) => (
          <View
            key={`seg-${idx}`}
            style={[
              styles.bookedSegment,
              { left: `${seg.left}%`, width: `${seg.width}%` },
            ]}
          />
        ))}

        {nowPercent !== null ? (
          <View style={[styles.nowMarker, { left: `${nowPercent}%` }]} />
        ) : null}
      </View>

      <View style={styles.timeLabels}>
        <Text style={styles.timeLabel}>{formatHour(startHour)}</Text>
        <Text style={styles.timeLabel}>{formatHour(Math.floor((startHour + endHour) / 2))}</Text>
        <Text style={styles.timeLabel}>{formatHour(endHour)}</Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendFree]} />
          <Text style={styles.legendText}>Free</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendBooked]} />
          <Text style={styles.legendText}>Booked</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendPast]} />
          <Text style={styles.legendText}>Past</Text>
        </View>
        {nowPercent !== null ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendNow]} />
            <Text style={styles.legendText}>Now</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12am";
  if (h === 12) return "12pm";
  if (h < 12) return `${h}am`;
  return `${h - 12}pm`;
}

const BAR_HEIGHT = 28;

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  barTrack: {
    position: "relative",
    height: BAR_HEIGHT,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(0, 191, 165, 0.18)",
    overflow: "hidden",
  },
  pastOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.border,
  },
  hourTick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: Colors.surface,
    opacity: 0.6,
  },
  bookedSegment: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(239, 68, 68, 0.78)",
  },
  nowMarker: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    marginLeft: -1,
    backgroundColor: Colors.accent,
    borderRadius: 1,
  },
  timeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  legend: {
    flexDirection: "row",
    gap: Spacing.lg,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendFree: {
    backgroundColor: "rgba(0, 191, 165, 0.45)",
  },
  legendBooked: {
    backgroundColor: "rgba(239, 68, 68, 0.78)",
  },
  legendPast: {
    backgroundColor: Colors.border,
  },
  legendNow: {
    backgroundColor: Colors.accent,
  },
  legendText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});
