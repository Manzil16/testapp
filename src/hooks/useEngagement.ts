import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STREAK_KEY = "engagement_streak";
const LAST_OPEN_KEY = "engagement_last_open";

interface StreakState {
  streak: number;
  lastOpen: string | null;
}

/** Track consecutive-day open streaks + generate retention nudges. */
export function useEngagement(stats?: {
  totalBookings: number;
  totalTrips: number;
  vehiclesRegistered: number;
}) {
  const [streakState, setStreakState] = useState<StreakState>({ streak: 0, lastOpen: null });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedStreak, storedLastOpen] = await Promise.all([
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(LAST_OPEN_KEY),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const streak = Number(storedStreak) || 0;

      if (storedLastOpen === today) {
        // Already opened today
        setStreakState({ streak, lastOpen: storedLastOpen });
      } else {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const isConsecutive = storedLastOpen === yesterday;
        const newStreak = isConsecutive ? streak + 1 : 1;

        await Promise.all([
          AsyncStorage.setItem(STREAK_KEY, String(newStreak)),
          AsyncStorage.setItem(LAST_OPEN_KEY, today),
        ]);
        setStreakState({ streak: newStreak, lastOpen: today });
      }

      setLoaded(true);
    })();
  }, []);

  const nudges = useMemo(() => {
    const items: Array<{ id: string; icon: string; title: string; subtitle: string }> = [];

    // Streak nudge
    if (loaded && streakState.streak >= 2) {
      items.push({
        id: "streak",
        icon: "flame",
        title: `${streakState.streak}-day streak!`,
        subtitle: "Keep exploring to grow your streak",
      });
    }

    // Time-of-day nudge
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) {
      items.push({
        id: "morning",
        icon: "sunny",
        title: "Morning charge window",
        subtitle: "Off-peak rates are live — book now for the best price",
      });
    } else if (hour >= 17 && hour < 21) {
      items.push({
        id: "evening",
        icon: "moon",
        title: "Evening top-up?",
        subtitle: "Charge overnight while rates are low",
      });
    }

    // First-time nudge
    if (stats && stats.totalBookings === 0) {
      items.push({
        id: "first-booking",
        icon: "rocket",
        title: "Make your first booking",
        subtitle: "Find a nearby charger and start your EV journey",
      });
    }

    // Vehicle nudge
    if (stats && stats.vehiclesRegistered === 0) {
      items.push({
        id: "add-vehicle",
        icon: "car-sport",
        title: "Add your vehicle",
        subtitle: "Get personalized range estimates and trip plans",
      });
    }

    return items;
  }, [loaded, stats, streakState.streak]);

  return { streak: streakState.streak, nudges, loaded };
}
