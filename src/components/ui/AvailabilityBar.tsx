import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { Colors, Typography, Spacing, Radius } from "@/src/features/shared/theme";

interface AvailabilityBarProps {
  chargerId: string;
  date?: string; // ISO date, defaults to today
}

interface SlotBooking {
  start_time: string;
  end_time: string;
}

export function AvailabilityBar({ chargerId, date }: AvailabilityBarProps) {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  const { data: bookings } = useQuery({
    queryKey: ["charger-availability", chargerId, targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("start_time, end_time")
        .eq("charger_id", chargerId)
        .in("status", ["approved", "active", "requested"])
        .gte("start_time", `${targetDate}T00:00:00`)
        .lte("start_time", `${targetDate}T23:59:59`);
      if (error) throw error;
      return (data ?? []) as SlotBooking[];
    },
    refetchInterval: 30_000,
  });

  const now = new Date();
  const currentHour = now.getHours();
  const isToday = targetDate === now.toISOString().split("T")[0];

  // 16 slots: 6:00 AM to 10:00 PM in 60-minute increments
  const slots = useMemo(() => {
    const result: Array<{ hour: number; status: "free" | "booked" | "past" }> = [];
    for (let h = 6; h <= 21; h++) {
      const slotStart = new Date(`${targetDate}T${String(h).padStart(2, "0")}:00:00`);
      const slotEnd = new Date(`${targetDate}T${String(h + 1).padStart(2, "0")}:00:00`);

      // Past slot?
      if (isToday && h < currentHour) {
        result.push({ hour: h, status: "past" });
        continue;
      }

      // Check if any booking overlaps with this slot
      const isBooked = (bookings ?? []).some((b) => {
        const bs = new Date(b.start_time);
        const be = new Date(b.end_time);
        return bs < slotEnd && be > slotStart;
      });

      result.push({ hour: h, status: isBooked ? "booked" : "free" });
    }
    return result;
  }, [bookings, targetDate, currentHour, isToday]);

  return (
    <View style={styles.container}>
      <View style={styles.barRow}>
        {slots.map((slot, idx) => (
          <View
            key={idx}
            style={[
              styles.slot,
              slot.status === "free" && styles.slotFree,
              slot.status === "booked" && styles.slotBooked,
              slot.status === "past" && styles.slotPast,
              isToday && slot.hour === currentHour && styles.slotCurrent,
            ]}
          />
        ))}
      </View>
      <View style={styles.timeLabels}>
        <Text style={styles.timeLabel}>6am</Text>
        <Text style={styles.timeLabel}>12pm</Text>
        <Text style={styles.timeLabel}>6pm</Text>
        <Text style={styles.timeLabel}>10pm</Text>
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.slotFree]} />
          <Text style={styles.legendText}>Free</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.slotBooked]} />
          <Text style={styles.legendText}>Booked</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.slotPast]} />
          <Text style={styles.legendText}>Past</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  barRow: {
    flexDirection: "row",
    gap: 3,
  },
  slot: {
    flex: 1,
    height: 24,
    borderRadius: Radius.sm,
  },
  slotFree: {
    backgroundColor: "rgba(0, 191, 165, 0.30)",
  },
  slotBooked: {
    backgroundColor: "rgba(239, 68, 68, 0.60)",
  },
  slotPast: {
    backgroundColor: Colors.border,
  },
  slotCurrent: {
    borderWidth: 2,
    borderColor: Colors.accent,
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
  legendText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});
