// VehicleGrid Design System — Light-only Theme
// Single source of truth for all styling

// ─── Light Theme Colors ─────────────────────────────────────────
export const Colors = {
  // Core backgrounds
  background: "#F5F5F5",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F1F4",
  surfaceElevated: "#FFFFFF",

  // Brand / Accent (teal)
  accent: "#00BFA5",
  accentDark: "#009E88",
  accentLight: "rgba(0, 191, 165, 0.10)",
  accentGlow: "rgba(0, 191, 165, 0.18)",

  // Legacy alias
  primary: "#00BFA5",
  primaryDark: "#009E88",
  primaryLight: "rgba(0, 191, 165, 0.10)",

  // Text
  textPrimary: "#111111",
  textSecondary: "#666666",
  textMuted: "#8E8EA0",
  textInverse: "#FFFFFF",

  // Borders
  border: "#E0E0E0",
  borderFocus: "#00BFA5",
  borderSubtle: "rgba(0, 0, 0, 0.04)",

  // Semantic
  success: "#10B981",
  successLight: "rgba(16, 185, 129, 0.10)",
  warning: "#F59E0B",
  warningLight: "rgba(245, 158, 11, 0.10)",
  error: "#EF4444",
  errorLight: "rgba(239, 68, 68, 0.10)",
  info: "#3B82F6",
  infoLight: "rgba(59, 130, 246, 0.10)",

  // Map
  mapAvailable: "#10B981",
  mapBusy: "#F59E0B",
  mapOffline: "#EF4444",

  // Badges
  topRatedLight: "rgba(245, 158, 11, 0.10)",

  // Shadow & Overlay
  shadow: "rgba(0, 0, 0, 0.08)",
  shadowStrong: "rgba(0, 0, 0, 0.15)",
  overlay: "rgba(0, 0, 0, 0.4)",

  // Glassmorphism
  glass: "rgba(0, 0, 0, 0.03)",
  glassBorder: "rgba(0, 0, 0, 0.06)",

  // Gradients (as arrays for LinearGradient)
  gradientAccent: ["#00BFA5", "#00A3D8"] as const,
  gradientDark: ["#F0F1F4", "#F5F5F5"] as const,
  gradientCard: ["rgba(0,0,0,0.02)", "rgba(0,0,0,0.01)"] as const,
  gradientHero: ["#00BFA5", "#00A3D8", "#0077B6"] as const,

  // Legacy backward compat
  card: "#FFFFFF",
  text: "#111111",
  muted: "#666666",
  danger: "#EF4444",
} as const;

// ─── Color scheme type ───
export type ColorScheme = { [K in keyof typeof Colors]: (typeof Colors)[K] extends readonly string[] ? readonly string[] : string };

// ─── LightColors kept as alias for backward compatibility ───
export const LightColors: ColorScheme = Colors;

/** Returns the light color palette (isDark param kept for API compat) */
export function getColors(_isDark?: boolean): ColorScheme {
  return Colors;
}

export const Typography = {
  pageTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    fontFamily: "Syne_700Bold",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
    fontFamily: "Syne_600SemiBold",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textPrimary,
    fontFamily: "DMSans_600SemiBold",
  },
  body: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: Colors.textSecondary,
    fontFamily: "DMSans_400Regular",
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: Colors.textMuted,
    fontFamily: "DMSans_400Regular",
  },
  priceHighlight: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.accent,
    fontFamily: "Syne_700Bold",
  },
  badge: {
    fontSize: 11,
    fontWeight: "600" as const,
    fontFamily: "DMSans_600SemiBold",
  },
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
    fontFamily: "DMSans_500Medium",
  },
  heroNumber: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
    fontFamily: "Syne_700Bold",
  },
} as const;

// 8pt spacing grid
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,

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
  card: 16,
  input: 12,
  pill: 999,
} as const;

export const Shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  button: {
    shadowColor: "#00BFA5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: {
    shadowColor: "#00BFA5",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  subtle: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;

export const Animation = {
  staggerDelay: 80,
  entranceDuration: 400,
  fadeIn: { duration: 300 },
  spring: { damping: 20, stiffness: 300 },
} as const;

export const RoleTheme = {
  driver: {
    accent: Colors.accent,
    tabIcon: "car-sport" as const,
    label: "Driver",
  },
  host: {
    accent: "#3B82F6",
    tabIcon: "flash" as const,
    label: "Host",
  },
  admin: {
    accent: "#F59E0B",
    tabIcon: "shield-checkmark" as const,
    label: "Admin",
  },
} as const;

// Backward-compatible theme object
export const theme = {
  colors: {
    primary: Colors.accent,
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
