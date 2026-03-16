// VehicleGrid Design System — Premium Dark-First Theme
// Single source of truth for all styling

export const Colors = {
  // Core backgrounds (dark-first)
  background: "#0F0F12",
  surface: "#1A1A22",
  surfaceAlt: "#22222E",
  surfaceElevated: "#2A2A38",

  // Brand / Accent
  accent: "#00E5CC",
  accentDark: "#00B8A3",
  accentLight: "rgba(0, 229, 204, 0.12)",
  accentGlow: "rgba(0, 229, 204, 0.25)",

  // Legacy alias
  primary: "#00E5CC",
  primaryDark: "#00B8A3",
  primaryLight: "rgba(0, 229, 204, 0.12)",

  // Text
  textPrimary: "#F5F5F0",
  textSecondary: "#A0A0B0",
  textMuted: "#6B6B80",
  textInverse: "#0F0F12",

  // Borders
  border: "rgba(255, 255, 255, 0.08)",
  borderFocus: "#00E5CC",
  borderSubtle: "rgba(255, 255, 255, 0.04)",

  // Semantic
  success: "#34D399",
  successLight: "rgba(52, 211, 153, 0.12)",
  warning: "#FBBF24",
  warningLight: "rgba(251, 191, 36, 0.12)",
  error: "#FF4757",
  errorLight: "rgba(255, 71, 87, 0.12)",
  info: "#60A5FA",
  infoLight: "rgba(96, 165, 250, 0.12)",

  // Map
  mapAvailable: "#34D399",
  mapBusy: "#FBBF24",
  mapOffline: "#FF4757",

  // Badges
  topRatedLight: "rgba(251, 191, 36, 0.12)",

  // Shadow & Overlay
  shadow: "rgba(0, 0, 0, 0.3)",
  shadowStrong: "rgba(0, 0, 0, 0.5)",
  overlay: "rgba(0, 0, 0, 0.6)",

  // Glassmorphism
  glass: "rgba(255, 255, 255, 0.05)",
  glassBorder: "rgba(255, 255, 255, 0.08)",

  // Gradients (as arrays for LinearGradient)
  gradientAccent: ["#00E5CC", "#00B4D8"] as const,
  gradientDark: ["#1A1A22", "#0F0F12"] as const,
  gradientCard: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.02)"] as const,
  gradientHero: ["#00E5CC", "#00B4D8", "#0077B6"] as const,

  // Legacy backward compat
  card: "#1A1A22",
  text: "#F5F5F0",
  muted: "#A0A0B0",
  danger: "#FF4757",
} as const;

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
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  button: {
    shadowColor: "#00E5CC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: {
    shadowColor: "#00E5CC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  subtle: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
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
    accent: "#60A5FA",
    tabIcon: "flash" as const,
    label: "Host",
  },
  admin: {
    accent: "#FBBF24",
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
