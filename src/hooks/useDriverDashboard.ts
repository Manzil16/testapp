import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listBookingsByDriver,
  listenToBookingsByDriver,
  type Booking,
} from "@/src/features/bookings";
import {
  listChargers,
  listenToChargers,
  type Charger,
} from "@/src/features/chargers";
import { listTripsByUser, listenToTripsByUser, type Trip } from "@/src/features/trips";
import {
  listVehiclesByUser,
  listenToVehiclesByUser,
  type Vehicle,
} from "@/src/features/vehicles";

interface DriverDashboardData {
  activeBooking: Booking | null;
  nearbyChargers: Charger[];
  chargersById: Record<string, Charger>;
  stats: {
    totalBookings: number;
    totalTrips: number;
    vehiclesRegistered: number;
  };
  bookings: Booking[];
  trips: Trip[];
  vehicles: Vehicle[];
}

const activeStatuses = new Set(["requested", "approved", "in_progress"]);

export function useDriverDashboard(userId?: string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setBookings([]);
      setTrips([]);
      setVehicles([]);
      setChargers([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    let bookingsReady = false;
    let tripsReady = false;
    let vehiclesReady = false;
    let chargersReady = false;

    const markReady = () => {
      if (bookingsReady && tripsReady && vehiclesReady && chargersReady) {
        setIsLoading(false);
      }
    };

    const unsubBookings = listenToBookingsByDriver(
      userId,
      (items) => {
        setBookings(items);
        bookingsReady = true;
        markReady();
      },
      (message) => {
        setError(message);
        bookingsReady = true;
        markReady();
      }
    );

    const unsubTrips = listenToTripsByUser(
      userId,
      (items) => {
        setTrips(items);
        tripsReady = true;
        markReady();
      },
      (message) => {
        setError(message);
        tripsReady = true;
        markReady();
      }
    );

    const unsubVehicles = listenToVehiclesByUser(
      userId,
      (items) => {
        setVehicles(items);
        vehiclesReady = true;
        markReady();
      },
      (message) => {
        setError(message);
        vehiclesReady = true;
        markReady();
      }
    );

    const unsubChargers = listenToChargers(
      (items) => {
        setChargers(items.filter((item) => item.status === "verified"));
        chargersReady = true;
        markReady();
      },
      undefined,
      (message) => {
        setError(message);
        chargersReady = true;
        markReady();
      }
    );

    return () => {
      unsubBookings();
      unsubTrips();
      unsubVehicles();
      unsubChargers();
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setError(null);
      const [bookingsResult, tripsResult, vehiclesResult, chargersResult] = await Promise.all([
        listBookingsByDriver(userId),
        listTripsByUser(userId),
        listVehiclesByUser(userId),
        listChargers({ status: "verified" }),
      ]);

      setBookings(bookingsResult);
      setTrips(tripsResult);
      setVehicles(vehiclesResult);
      setChargers(chargersResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh dashboard.");
    }
  }, [userId]);

  const data = useMemo<DriverDashboardData>(() => {
    const sortedActive = [...bookings]
      .filter((item) => activeStatuses.has(item.status))
      .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));

    return {
      activeBooking: sortedActive[0] || null,
      nearbyChargers: chargers.slice(0, 8),
      chargersById: Object.fromEntries(chargers.map((item) => [item.id, item])),
      stats: {
        totalBookings: bookings.length,
        totalTrips: trips.length,
        vehiclesRegistered: vehicles.length,
      },
      bookings,
      trips,
      vehicles,
    };
  }, [bookings, chargers, trips, vehicles]);

  return {
    data,
    isLoading,
    error,
    refresh,
  };
}
