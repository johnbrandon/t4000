// Design language: the classic Blue Note jazz LP covers of the 1950s
// (Reid Miles / Francis Wolff) — warm off-white "paper" stock, deep ink,
// a signature cobalt blue with a hot vermillion spot color, and bold
// geometric-grotesque type set large, uppercase and tightly tracked.
export const theme = {
  color: {
    background: "#EDE3CE", // aged paper / cream stock
    surface: "#F6EFDC", // lighter card stock
    surfaceRaised: "#E2D6BB", // deeper cream panel
    border: "#CBBB98", // tan rule
    textPrimary: "#181712", // ink black
    textSecondary: "#4A4638", // warm sepia ink
    textMuted: "#897F63", // faded tan ink
    accent: "#1E4E8C", // Blue Note cobalt
    accentAlt: "#C8461F", // vermillion spot color
    accentBlue: "#14243F", // deep navy
    warning: "#C4901C", // mustard
    danger: "#B23A2E", // brick red
  },
  spacing: (n: number) => n * 4,
  radius: {
    sm: 3,
    md: 5,
    lg: 8,
    pill: 999,
  },
  font: {
    hero: 34,
    title: 22,
    subtitle: 17,
    body: 15,
    caption: 12,
    // Grotesque body face (Helvetica) and a geometric display face (Futura,
    // with a Century Gothic fallback on Windows) — the two type families
    // Reid Miles built the Blue Note covers from.
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    display: 'Futura, "Century Gothic", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
} as const;

// Activity colors — a restrained Blue Note palette that reads on cream stock:
// cobalt, teal, mustard, vermillion, plum, olive and warm browns.
export const activityColors: Record<string, string> = {
  "Biz dev": "#1E4E8C", // cobalt
  Buyer: "#1E6E5C", // teal green
  Coffee: "#7A4A24", // coffee brown
  Landlord: "#14243F", // navy
  Meeting: "#C4901C", // mustard
  Other: "#6B6350", // warm gray
  Seller: "#C8461F", // vermillion
  Social: "#9C3B6E", // plum
  Sphere: "#2E7D8A", // teal blue
  Travel: "#4A6B2F", // olive
};

export function activityColor(activity: string): string {
  return activityColors[activity] ?? theme.color.accent;
}

// GitHub-contributions green scale, warmed to sit on the cream stock:
// 0 interactions -> 4+. Level 0 is the empty paper panel.
export const CONTRIBUTION_LEVELS = ["#E2D6BB", "#9CC7A0", "#5DA271", "#347C4E", "#1C5533"];

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
  return `hsl(${Math.round(hue)}, 70%, 52%)`;
}
