// Design language: Vitsœ / Dieter Rams industrial minimalism — "as little
// design as possible." An austere, fully monochrome scheme on a plain white
// ground: charcoal ink, neutral grays, hairline rules and generous whitespace.
// No color at all — identity is carried by type, icons and position. Set in the
// platform's own system font, mostly sentence-case; small control-panel labels
// are tracked caps.
export const theme = {
  color: {
    background: "#FBFBFB", // plain white ground
    surface: "#FFFFFF", // white card
    surfaceRaised: "#ECECEC", // faint raised panel
    border: "#E4E4E4", // hairline rule
    textPrimary: "#171717", // near-black ink
    textSecondary: "#575757", // charcoal gray
    textMuted: "#8C8C8C", // mid gray
    accent: "#282828", // charcoal (the single functional ink)
    accentAlt: "#282828", // charcoal
    accentBlue: "#4D4D4D", // dark gray (secondary data value)
    warning: "#6E6E6E", // gray
    danger: "#282828", // charcoal (destructive; confirm text carries the intent)
  },
  spacing: (n: number) => n * 4,
  radius: {
    sm: 2,
    md: 4,
    lg: 6,
    pill: 999,
  },
  font: {
    hero: 30,
    title: 20,
    subtitle: 16,
    body: 15,
    caption: 12,
    // The platform's own system UI font — no bundled or forced typeface.
    family: "System",
  },
} as const;

// Monochrome scheme: every activity shares the same charcoal ink. Identity is
// carried by each activity's icon and label, not by color.
export function activityColor(_activity?: string): string {
  return theme.color.accent;
}

// A single neutral gray sequential ramp for the contribution grid: 0
// interactions -> 4+. Level 0 is the empty panel; the steps darken to charcoal.
export const CONTRIBUTION_LEVELS = ["#ECECEC", "#C8C8C8", "#9A9A9A", "#5E5E5E", "#282828"];

export function contributionColor(count: number): string {
  const level = count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;
  return CONTRIBUTION_LEVELS[level];
}

// Temperature gradient — monochrome: cool days read light, warm days read dark.
// A single neutral gray ramp (no hue) keeps the whole scheme colorless. The
// domain is usually derived from the actual data (see YearScreen); these
// constants are only the fallback when there isn't enough data.
export const TEMP_MIN_C = ((0 - 32) * 5) / 9; // 0°F ≈ -17.8°C
export const TEMP_MAX_C = ((100 - 32) * 5) / 9; // 100°F ≈ 37.8°C

export function tempToColor(celsius: number, minC = TEMP_MIN_C, maxC = TEMP_MAX_C): string {
  const span = maxC - minC || 1;
  const clamped = Math.max(minC, Math.min(maxC, celsius));
  const t = (clamped - minC) / span;
  // Light gray (cold) -> charcoal (hot).
  const light = Math.round(82 - 62 * t);
  return `hsl(0, 0%, ${light}%)`;
}
