export const theme = {
  color: {
    background: "#F4F5F7", // light scheme
    surface: "#FFFFFF",
    surfaceRaised: "#E9ECF1",
    border: "#D8DCE3",
    textPrimary: "#16181D",
    textSecondary: "#4C5059",
    textMuted: "#8A8F9A",
    accent: "#1DB981", // green, darkened for contrast on light
    accentAlt: "#E24B3B", // red
    accentBlue: "#2F6BE0", // blue
    warning: "#D98A0B", // amber
    danger: "#E24B3B",
  },
  spacing: (n: number) => n * 4,
  radius: {
    sm: 8,
    md: 14,
    lg: 22,
    pill: 999,
  },
  font: {
    hero: 34,
    title: 22,
    subtitle: 17,
    body: 15,
    caption: 12,
  },
} as const;

// Activity colors, chosen to read on a light surface.
export const activityColors: Record<string, string> = {
  "Biz dev": "#6B74E8",
  Buyer: "#1DB981",
  Coffee: "#9B6A3C",
  Landlord: "#2F6BE0",
  Meeting: "#C79212",
  Other: "#7A7F8A",
  Renter: "#A063D6",
  Seller: "#E24B3B",
  Social: "#E0609F",
  Sphere: "#1FA5B5",
  Subway: "#3E7CA8",
};

export function activityColor(activity: string): string {
  return activityColors[activity] ?? theme.color.accent;
}

// Temperature gradient: cold (blue) -> hot (red). Uses HSL hue 240 (blue) down
// to 0 (red) through green. The domain is usually derived from the actual data
// (see YearScreen) so the full gradient is used and contrast stays strong; these
// constants are only the fallback when there isn't enough data.
export const TEMP_MIN_C = ((0 - 32) * 5) / 9; // 0°F ≈ -17.8°C
export const TEMP_MAX_C = ((100 - 32) * 5) / 9; // 100°F ≈ 37.8°C

export function tempToColor(celsius: number, minC = TEMP_MIN_C, maxC = TEMP_MAX_C): string {
  const span = maxC - minC || 1;
  const clamped = Math.max(minC, Math.min(maxC, celsius));
  const t = (clamped - minC) / span;
  const hue = 240 * (1 - t);
  return `hsl(${Math.round(hue)}, 70%, 52%)`;
}
