import { Colors, type ColorScheme } from "@/src/features/shared/theme";

/**
 * Returns the app color palette (always light theme).
 */
export function useThemeColors(): ColorScheme {
  return Colors;
}
