import { useState, useCallback } from "react";
import { searchAddress, type GeoResult } from "../services/geocodingService";
import { getRoutePlan, type RoutePlanResult } from "../services/routingService";

export interface LocationDraft {
  label: string;
  lat: number | null;
  lng: number | null;
}

export type PlannerStatus = "idle" | "planning" | "done" | "error";

const EMPTY_LOCATION: LocationDraft = { label: "", lat: null, lng: null };

export function useRoutePlanner(vehicleId: string | undefined) {
  const [origin, setOrigin] = useState<LocationDraft>(EMPTY_LOCATION);
  const [destination, setDestination] = useState<LocationDraft>(EMPTY_LOCATION);
  const [currentSoc, setCurrentSoc] = useState(80);

  const [originQuery, setOriginQuery]           = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [originSuggestions, setOriginSuggestions]           = useState<GeoResult[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<GeoResult[]>([]);
  const [geocodingOrigin, setGeocodingOrigin]           = useState(false);
  const [geocodingDestination, setGeocodingDestination] = useState(false);

  const [status, setStatus]   = useState<PlannerStatus>("idle");
  const [result, setResult]   = useState<RoutePlanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Geocoding search ──────────────────────────────────────────────────────

  const searchOrigin = useCallback(async (query: string) => {
    setOriginQuery(query);
    setOrigin(EMPTY_LOCATION); // clear confirmed location while typing
    if (query.length < 3) { setOriginSuggestions([]); return; }
    setGeocodingOrigin(true);
    try {
      const results = await searchAddress(query);
      setOriginSuggestions(results);
    } catch {
      setOriginSuggestions([]);
    } finally {
      setGeocodingOrigin(false);
    }
  }, []);

  const searchDestination = useCallback(async (query: string) => {
    setDestinationQuery(query);
    setDestination(EMPTY_LOCATION);
    if (query.length < 3) { setDestinationSuggestions([]); return; }
    setGeocodingDestination(true);
    try {
      const results = await searchAddress(query);
      setDestinationSuggestions(results);
    } catch {
      setDestinationSuggestions([]);
    } finally {
      setGeocodingDestination(false);
    }
  }, []);

  const selectOrigin = useCallback((geo: GeoResult) => {
    setOrigin({ label: geo.displayName, lat: geo.latitude, lng: geo.longitude });
    setOriginQuery(geo.displayName);
    setOriginSuggestions([]);
  }, []);

  const selectDestination = useCallback((geo: GeoResult) => {
    setDestination({ label: geo.displayName, lat: geo.latitude, lng: geo.longitude });
    setDestinationQuery(geo.displayName);
    setDestinationSuggestions([]);
  }, []);

  // ── Trip planning ─────────────────────────────────────────────────────────

  const planTrip = useCallback(async () => {
    if (!vehicleId) {
      setErrorMsg("Add your vehicle profile first so we know your battery size and efficiency.");
      setStatus("error");
      return;
    }
    if (origin.lat == null || origin.lng == null) {
      setErrorMsg("Please select a starting location from the suggestions.");
      setStatus("error");
      return;
    }
    if (destination.lat == null || destination.lng == null) {
      setErrorMsg("Please select a destination from the suggestions.");
      setStatus("error");
      return;
    }

    setStatus("planning");
    setResult(null);
    setErrorMsg(null);

    try {
      const plan = await getRoutePlan({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        vehicleId,
        currentSocPercent: currentSoc,
      });
      setResult(plan);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Trip planning failed. Please try again.");
      setStatus("error");
    }
  }, [vehicleId, origin, destination, currentSoc]);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setErrorMsg(null);
    setOrigin(EMPTY_LOCATION);
    setDestination(EMPTY_LOCATION);
    setOriginQuery("");
    setDestinationQuery("");
    setOriginSuggestions([]);
    setDestinationSuggestions([]);
    setCurrentSoc(80);
  }, []);

  const canPlan =
    origin.lat != null &&
    destination.lat != null &&
    Boolean(vehicleId) &&
    status !== "planning";

  return {
    // Inputs
    originQuery, destinationQuery,
    currentSoc, setCurrentSoc,
    // Suggestions
    originSuggestions, destinationSuggestions,
    geocodingOrigin, geocodingDestination,
    // Confirmed locations
    origin, destination,
    // Search handlers
    searchOrigin, searchDestination,
    selectOrigin, selectDestination,
    // Plan
    planTrip, canPlan, reset,
    // Results
    status, result, errorMsg,
  };
}
