// Two color schemes, switchable at runtime:
//   - "light": the austere Vitsœ / Dieter Rams monochrome scheme (charcoal ink
//     on white; color reserved for the green contribution grid and the
//     temperature heatmap).
//   - "night": an Apple Watch night-mode aesthetic — red on true black, tuned
//     so every label and data visualization stays legible in the dark.
//
// Flat colors are exposed as CSS custom properties (see `theme.color`), so the
// whole UI re-themes instantly when <html data-theme> flips — no re-render
// needed. SVG charts and the Leaflet map can't use var() in their fill
// attributes, so they read concrete values from PALETTES via useThemePalette().

export type ThemeName = "light" | "night";

export const TEMP_MIN_C = ((0 - 32) * 5) / 9; // 0°F ≈ -17.8°C
export const TEMP_MAX_C = ((100 - 32) * 5) / 9; // 100°F ≈ 37.8°C

// Light heatmap: cold (blue) -> hot (red), through green.
function heatLight(celsius: number, minC = TEMP_MIN_C, maxC = TEMP_MAX_C): string {
  const span = maxC - minC || 1;
  const t = (Math.max(minC, Math.min(maxC, celsius)) - minC) / span;
  return `hsl(${Math.round(240 * (1 - t))}, 60%, 52%)`;
}

// Night heatmap: a single red ramp — dim red (cold) -> bright red (hot) — so it
// reads in the dark without breaking the monochrome-red aesthetic.
function heatNight(celsius: number, minC = TEMP_MIN_C, maxC = TEMP_MAX_C): string {
  const span = maxC - minC || 1;
  const t = (Math.max(minC, Math.min(maxC, celsius)) - minC) / span;
  return `hsl(6, 85%, ${Math.round(26 + 38 * t)}%)`;
}

export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentAlt: string;
  accentBlue: string;
  warning: string;
  danger: string;
  // Pre-composited soft tints (base at ~15%, ~33% alpha) so styles never have
  // to concatenate alpha onto a color string.
  accentSoft: string;
  dangerSoft: string;
  dangerLine: string;
  textMutedSoft: string;
  // Contribution grid ramp, 0 interactions -> 4+.
  contributionLevels: [string, string, string, string, string];
  tempColor: (celsius: number, minC?: number, maxC?: number) => string;
}

export const PALETTES: Record<ThemeName, Palette> = {
  light: {
    background: "#FBFBFB",
    surface: "#FFFFFF",
    surfaceRaised: "#ECECEC",
    border: "#E4E4E4",
    textPrimary: "#171717",
    textSecondary: "#575757",
    textMuted: "#8C8C8C",
    accent: "#282828",
    accentAlt: "#282828",
    accentBlue: "#4D4D4D",
    warning: "#6E6E6E",
    danger: "#282828",
    accentSoft: "#28282826",
    dangerSoft: "#28282826",
    dangerLine: "#28282855",
    textMutedSoft: "#8C8C8C26",
    contributionLevels: ["#ECECEC", "#9BE9A8", "#40C463", "#30A14E", "#216E39"],
    tempColor: heatLight,
  },
  night: {
    background: "#000000",
    surface: "#0C0000",
    surfaceRaised: "#180404",
    border: "#3A0D0D",
    textPrimary: "#FF453A", // Apple system red — bright enough to read on black
    textSecondary: "#E24A3F",
    textMuted: "#B23A32",
    accent: "#FF453A",
    accentAlt: "#FF453A",
    accentBlue: "#E24A3F",
    warning: "#FF6A5E",
    danger: "#FF453A",
    accentSoft: "#FF453A26",
    dangerSoft: "#FF453A26",
    dangerLine: "#FF453A55",
    textMutedSoft: "#B23A3226",
    contributionLevels: ["#180404", "#4A100C", "#8A1E16", "#C43128", "#FF453A"],
    tempColor: heatNight,
  },
};

// Shared, theme-independent scales.
const spacing = (n: number) => n * 4;
const radius = { sm: 2, md: 4, lg: 6, pill: 999 };
const font = {
  hero: 30,
  title: 20,
  subtitle: 16,
  body: 15,
  caption: 12,
  // The platform's own system UI font — no bundled or forced typeface.
  family: "System",
};

const cvar = (key: string) => `var(--c-${key})`;

// The tokens used by every StyleSheet / View / Text style. They resolve to CSS
// custom properties, so flipping <html data-theme> re-themes the UI with no
// re-render. (On native, react-native-web isn't involved; the app runs in light
// mode there — the deploy target is the web PWA.)
export const theme = {
  color: {
    background: cvar("background"),
    surface: cvar("surface"),
    surfaceRaised: cvar("surfaceRaised"),
    border: cvar("border"),
    textPrimary: cvar("textPrimary"),
    textSecondary: cvar("textSecondary"),
    textMuted: cvar("textMuted"),
    accent: cvar("accent"),
    accentAlt: cvar("accentAlt"),
    accentBlue: cvar("accentBlue"),
    warning: cvar("warning"),
    danger: cvar("danger"),
    accentSoft: cvar("accentSoft"),
    dangerSoft: cvar("dangerSoft"),
    dangerLine: cvar("dangerLine"),
    textMutedSoft: cvar("textMutedSoft"),
  },
  spacing,
  radius,
  font,
} as const;

// Grid cell colors as CSS vars so unlogged/logged cells re-theme automatically
// (the grid is drawn with Views, which do accept var()).
export const CONTRIBUTION_LEVELS = [0, 1, 2, 3, 4].map((i) => `var(--grid-${i})`);

export function contributionColor(count: number): string {
  const level = count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;
  return CONTRIBUTION_LEVELS[level];
}

// The <style> block that defines the custom properties for both themes. Injected
// once on web; `data-theme="night"` on <html> selects the night values.
export function themeCssVariables(): string {
  const decl = (p: Palette) =>
    [
      `--c-background:${p.background}`,
      `--c-surface:${p.surface}`,
      `--c-surfaceRaised:${p.surfaceRaised}`,
      `--c-border:${p.border}`,
      `--c-textPrimary:${p.textPrimary}`,
      `--c-textSecondary:${p.textSecondary}`,
      `--c-textMuted:${p.textMuted}`,
      `--c-accent:${p.accent}`,
      `--c-accentAlt:${p.accentAlt}`,
      `--c-accentBlue:${p.accentBlue}`,
      `--c-warning:${p.warning}`,
      `--c-danger:${p.danger}`,
      `--c-accentSoft:${p.accentSoft}`,
      `--c-dangerSoft:${p.dangerSoft}`,
      `--c-dangerLine:${p.dangerLine}`,
      `--c-textMutedSoft:${p.textMutedSoft}`,
      ...p.contributionLevels.map((c, i) => `--grid-${i}:${c}`),
    ].join(";");
  return (
    `:root{${decl(PALETTES.light)};}` +
    `:root[data-theme="night"]{${decl(PALETTES.night)};}` +
    `html,body{background:var(--c-background);}`
  );
}
