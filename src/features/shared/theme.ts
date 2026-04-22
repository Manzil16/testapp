// VehicleGrid Design System — Light-only Theme
// Single source of truth for all styling

// ─── Light Theme Colors ─────────────────────────────────────────
export const Colors = {
  // Core backgrounds
  background: "#F8F9FB",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  surfaceElevated: "#FFFFFF",

  // Brand / Accent (teal)
  accent: "#00BFA5",
  accentDark: "#00897B",
  accentLight: "#E0F2F1",
  accentGlow: "rgba(0, 191, 165, 0.18)",
  accentMuted: "#B2DFDB",

  // Legacy alias
  primary: "#00BFA5",
  primaryDark: "#00897B",
  primaryLight: "#E0F2F1",

  // Text
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  textInverse: "#FFFFFF",

  // Borders
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  borderFocus: "#00BFA5",
  borderSubtle: "rgba(0, 0, 0, 0.04)",

  // Semantic
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",
  info: "#3B82F6",
  infoLight: "#DBEAFE",

  // Map
  mapAvailable: "#10B981",
  mapBusy: "#F59E0B",
  mapOffline: "#EF4444",

  // Badges
  topRatedLight: "#FEF3C7",

  // Shadow & Overlay
  shadow: "rgba(15, 23, 42, 0.08)",
  shadowStrong: "rgba(15, 23, 42, 0.15)",
  overlay: "rgba(0, 0, 0, 0.4)",

  // Glassmorphism
  glass: "rgba(0, 0, 0, 0.03)",
  glassBorder: "rgba(0, 0, 0, 0.06)",

  // Gradients (as arrays for LinearGradient)
  gradientAccent: ["#00BFA5", "#00897B"] as const,
  gradientDark: ["#F1F5F9", "#F8F9FB"] as const,
  gradientCard: ["rgba(0,0,0,0.02)", "rgba(0,0,0,0.01)"] as const,
  gradientHero: ["#00BFA5", "#00897B"] as const,
  gradientDanger: ["#EF4444", "#DC2626"] as const,

  // Legacy backward compat
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#475569",
  danger: "#EF4444",
} as const;

// ─── Color scheme type ───
export type ColorScheme = {
  [K in keyof typeof Colors]: (typeof Colors)[K] extends readonly string[]
    ? readonly string[]
    : string;
};

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
    letterSpacing: -0.8,
    fontFamily: "Syne_700Bold",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700" as const,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    fontFamily: "Syne_700Bold",
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
    lineHeight: 21,
    fontFamily: "DMSans_400Regular",
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: Colors.textMuted,
    fontFamily: "DMSans_400Regular",
  },
  priceHighlight: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.accent,
    fontFamily: "Syne_700Bold",
  },
  badge: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    fontFamily: "DMSans_700Bold",
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
  screenPadding: 20,
  cardPadding: 18,
  sectionGap: 28,
  elementGap: 12,
  microGap: 8,
} as const;

export const Radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  full: 999,

  // Semantic aliases
  card: 16,
  input: 12,
  pill: 999,
} as const;

export const Shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHover: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  modal: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  button: {
    shadowColor: "#00BFA5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  sticky: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  glow: {
    shadowColor: "#00BFA5",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  subtle: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
} as const;

export const Animation = {
  staggerDelay: 60,
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
