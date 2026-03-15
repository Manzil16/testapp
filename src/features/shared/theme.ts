// VehicleGrid Design System — Single source of truth for all styling

export const Colors = {
  // Backgrounds
  background: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F2F5",

  // Brand
  primary: "#1DB954",
  primaryDark: "#17A848",
  primaryLight: "#E8F8EF",

  // Text
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  textInverse: "#FFFFFF",

  // Borders
  border: "#E5E7EB",
  borderFocus: "#1DB954",

  // Semantic
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",
  info: "#3B82F6",
  infoLight: "#DBEAFE",
  topRatedLight: "#FFF7E6",
  mapAvailable: "#10B981",
  mapBusy: "#F59E0B",
  mapOffline: "#EF4444",

  // Shadow base
  shadow: "rgba(0,0,0,0.06)",
  shadowStrong: "rgba(0,0,0,0.12)",

  // Overlay
  overlay: "rgba(0,0,0,0.4)",

  // Legacy aliases (for backward compatibility with existing code)
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  danger: "#EF4444",
} as const;

export const Typography = {
  pageTitle: {
    fontSize: 26,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: Colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: Colors.textMuted,
  },
  priceHighlight: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  badge: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,

  // Semantic aliases
  screenPadding: 16,
  cardPadding: 16,
  sectionGap: 24,
  elementGap: 12,
  microGap: 8,
} as const;

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 999,

  // Semantic aliases
  card: 12,
  input: 8,
  pill: 999,
} as const;

export const Shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  button: {
    shadowColor: "#1DB954",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const Animation = {
  staggerDelay: 80,
  entranceDuration: 400,
  fadeIn: { duration: 300 },
} as const;

export const RoleTheme = {
  driver: {
    accent: Colors.primary,
    tabIcon: "car-sport" as const,
    label: "Driver",
  },
  host: {
    accent: Colors.primary,
    tabIcon: "flash" as const,
    label: "Host",
  },
  admin: {
    accent: Colors.primary,
    tabIcon: "shield-checkmark" as const,
    label: "Admin",
  },
} as const;

// Backward-compatible theme object (used by existing code)
export const theme = {
  colors: {
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    muted: Colors.textSecondary,
    danger: Colors.error,
    warning: Colors.warning,
    success: Colors.success,
    border: Colors.border,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
  },
  radius: {
    sm: Radius.md,
    md: Radius.lg,
    lg: Radius.xl,
  },
};
