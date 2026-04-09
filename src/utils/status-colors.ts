import { Colors } from "@/src/features/shared/theme";

export type BookingStatus =
  | "requested"
  | "approved"
  | "active"
  | "completed"
  | "cancelled"
  | "declined"
  | "expired"
  | "missed";

export type ChargerStatus = "active" | "pending" | "rejected" | "inactive";

export function getBookingStatusColor(status: BookingStatus): string {
  switch (status) {
    case "requested":
      return Colors.warning;
    case "approved":
      return Colors.info;
    case "active":
      return Colors.accent;
    case "completed":
      return Colors.success;
    case "missed":
    case "declined":
      return Colors.error;
    case "cancelled":
    case "expired":
      return Colors.textMuted;
    default:
      return Colors.textSecondary;
  }
}

export function getBookingStatusBackground(status: BookingStatus): string {
  switch (status) {
    case "requested":
      return Colors.warningLight;
    case "approved":
      return Colors.infoLight;
    case "active":
      return Colors.accentLight;
    case "completed":
      return Colors.successLight;
    case "missed":
    case "declined":
      return Colors.errorLight;
    case "cancelled":
    case "expired":
      return Colors.surfaceAlt;
    default:
      return Colors.surfaceAlt;
  }
}

export function getChargerStatusColor(status: ChargerStatus): string {
  switch (status) {
    case "active":
      return Colors.success;
    case "pending":
      return Colors.warning;
    case "rejected":
      return Colors.error;
    case "inactive":
      return Colors.textMuted;
    default:
      return Colors.textMuted;
  }
}

export function getChargerStatusBackground(status: ChargerStatus): string {
  switch (status) {
    case "active":
      return Colors.successLight;
    case "pending":
      return Colors.warningLight;
    case "rejected":
      return Colors.errorLight;
    case "inactive":
      return Colors.surfaceAlt;
    default:
      return Colors.surfaceAlt;
  }
}
