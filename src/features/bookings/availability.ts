import type {
  AvailabilityDay,
  ChargerAvailabilityWindow,
} from "../chargers/charger.types";

const DAY_BY_INDEX: AvailabilityDay[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseHHmm(value: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesOfLocalDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export type AvailabilityCheck =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validate a booking time range against the host's declared availability window.
 * Returns { ok: true } when no window is set or the range fits. Single-day windows
 * only — overnight windows (endTime <= startTime) are treated as "no enforcement".
 */
export function validateBookingAvailability(
  window: ChargerAvailabilityWindow | null | undefined,
  startIso: string,
  endIso: string,
): AvailabilityCheck {
  if (!window) return { ok: true };

  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return { ok: false, reason: "Booking time range is invalid." };
  }

  if (start.toDateString() !== end.toDateString()) {
    return {
      ok: false,
      reason: "Booking must start and end on the same day for this charger.",
    };
  }

  const day = DAY_BY_INDEX[start.getDay()];
  if (window.days?.length && !window.days.includes(day)) {
    return {
      ok: false,
      reason: `This charger is not available on ${day}. Host accepts: ${window.days.join(", ")}.`,
    };
  }

  const winStart = parseHHmm(window.startTime);
  const winEnd = parseHHmm(window.endTime);
  if (winStart == null || winEnd == null || winEnd <= winStart) {
    return { ok: true };
  }

  const bookingStart = minutesOfLocalDay(start);
  const bookingEnd = minutesOfLocalDay(end);
  if (bookingStart < winStart || bookingEnd > winEnd) {
    return {
      ok: false,
      reason: `Booking must fall within the host's hours (${window.startTime}–${window.endTime}).`,
    };
  }

  return { ok: true };
}
