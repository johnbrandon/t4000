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
  Run: "#3DDC97",
  Walk: "#7FE0B8",
  Ride: "#4C8DFF",
  Strength: "#FF6154",
  Yoga: "#C792EA",
  Swim: "#3ABEFF",
  Hike: "#A0D468",
  Work: "#9B9BA8",
  Meeting: "#61616D",
  Meal: "#F5B942",
  Social: "#FF8DC7",
  Travel: "#4CD3E0",
  Rest: "#61616D",
  Other: "#8A8A96",
};

export function activityColor(activity: string): string {
  return activityColors[activity] ?? theme.color.accent;
}

// Temperature gradient: cold (blue) -> hot (red), spanning -10°C..38°C
// (~14°F..100°F). Uses HSL hue 240 (blue) down to 0 (red) through green.
export const TEMP_MIN_C = -10;
export const TEMP_MAX_C = 38;

export function tempToColor(celsius: number): string {
  const clamped = Math.max(TEMP_MIN_C, Math.min(TEMP_MAX_C, celsius));
  const t = (clamped - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C);
  const hue = 240 * (1 - t);
  return `hsl(${Math.round(hue)}, 68%, 52%)`;
}
