import colors from "@/constants/colors";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Returns the design tokens for the current resolved theme.
 * Respects user's manual override (light / dark / system) via ThemeContext.
 */
export function useColors() {
  const { resolvedTheme } = useTheme();
  const palette =
    resolvedTheme === "dark" && "dark" in colors
      ? (colors as Record<string, typeof colors.light>).dark
      : colors.light;
  return { ...palette, radius: colors.radius };
}
