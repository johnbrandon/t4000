// Design language: Vitsœ / Dieter Rams industrial minimalism — "as little
// design as possible." A warm off-white paper ground, near-black ink, hairline
// rules, generous whitespace, and a single restrained functional accent (a
// muted Braun signal orange). Type is a quiet neutral grotesque, mostly
// sentence-case; only small control-panel labels are set in tracked caps.
export const theme = {
  color: {
    background: "#F2F1EC", // warm paper white
    surface: "#FBFAF7", // near-white card
    surfaceRaised: "#E9E7E1", // faint raised panel
    border: "#DDDBD4", // hairline rule
    textPrimary: "#1D1C19", // near-black ink
    textSecondary: "#605D56", // warm gray
    textMuted: "#948F87", // muted gray
    accent: "#B15C2C", // muted Braun signal orange (the one functional color)
    accentAlt: "#8F4A2A", // deeper burnt orange (timer running)
    accentBlue: "#45607B", // muted slate (secondary data color)
    warning: "#A9832A", // muted amber
    danger: "#A6442E", // muted brick red
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
    // One neutral grotesque throughout — no decorative display face.
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
} as const;

// Activity colors — a muted, desaturated industrial palette that sits quietly
// on the paper ground: slate, sage, ochre, terracotta and warm grays.
export const activityColors: Record<string, string> = {
  "Biz dev": "#3E5C7E", // muted slate blue
  Buyer: "#4F7A5B", // muted sage green
  Coffee: "#7A5A3C", // muted brown
  Landlord: "#52616B", // slate gray
  Meeting: "#9A7B33", // muted ochre
  Other: "#7C7A73", // warm gray
  Seller: "#B15C2C", // terracotta (the signal accent)
  Social: "#8A5A6E", // muted mauve
  Sphere: "#4C7A80", // muted teal
  Travel: "#6B7048", // muted olive
};

export function activityColor(activity: string): string {
  return activityColors[activity] ?? theme.color.accent;
}

// A single muted-sage sequential ramp for the contribution grid: 0 interactions
// -> 4+. Level 0 is the empty paper panel; the steps stay desaturated to sit
// quietly on the paper ground.
export const CONTRIBUTION_LEVELS = ["#E4E2DB", "#BFC9B4", "#93AB86", "#5F7E5A", "#3A5537"];

export function contributionColor(count: number): string {
  const level = count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;
  return CONTRIBUTION_LEVELS[level];
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
  // Kept low-saturation so the temperature ramp reads as muted, not neon.
  return `hsl(${Math.round(hue)}, 45%, 52%)`;
}
