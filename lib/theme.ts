export const theme = {
  color: {
    background: "#0B0B0F",
    surface: "#16161D",
    surfaceRaised: "#1F1F29",
    border: "#2A2A36",
    textPrimary: "#F5F5F7",
    textSecondary: "#9B9BA8",
    textMuted: "#61616D",
    accent: "#3DDC97", // strava-green adjacent
    accentAlt: "#FF6154", // foursquare-red adjacent
    accentBlue: "#4C8DFF", // whoop-blue adjacent
    warning: "#F5B942",
    danger: "#FF5C5C",
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

export const activityColors: Record<string, string> = {
  "Biz dev": "#8B95FF",
  Buyer: "#3DDC97",
  Landlord: "#4C8DFF",
  Renter: "#C792EA",
  Seller: "#FF6154",
  Social: "#FF8DC7",
  Sphere: "#4CD3E0",
  Travel: "#F5B942",
};

export function activityColor(activity: string): string {
  return activityColors[activity] ?? theme.color.accent;
}

// Temperature gradient: cold (blue) -> hot (red). Uses HSL hue 240 (blue) down
// to 0 (red) through green. The domain is usually derived from the actual data
// (see YearScreen) so the full gradient is used and contrast stays strong; these
// constants are only the fallback when there isn't enough data.
export const TEMP_MIN_C = 0;
export const TEMP_MAX_C = 35;

export function tempToColor(celsius: number, minC = TEMP_MIN_C, maxC = TEMP_MAX_C): string {
  const span = maxC - minC || 1;
  const clamped = Math.max(minC, Math.min(maxC, celsius));
  const t = (clamped - minC) / span;
  const hue = 240 * (1 - t);
  return `hsl(${Math.round(hue)}, 70%, 52%)`;
}
