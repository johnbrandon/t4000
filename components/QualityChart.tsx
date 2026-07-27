import { useMemo, useState } from "react";
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { dateKey, daysInMonth, MONTH_INITIALS } from "../lib/dayGrid";
import { useThemePalette } from "../lib/ThemeContext";
import { theme } from "../lib/theme";
import { QUALITY_MAX, QUALITY_MIN, QUALITY_NEUTRAL } from "../lib/types";

const CHART_FONT = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" : undefined;
const H = 130;
const PAD_X = 8;
const PAD_Y = 16;
const MAX_ABS = QUALITY_MAX - QUALITY_NEUTRAL; // distance from neutral to an extreme (2)

// Diverging bar chart: average interaction quality per day, drawn above (green)
// and below (red) a neutral zero line.
export default function QualityChart({
  year,
  qualityByDay,
}: {
  year: number;
  qualityByDay: Map<string, number>;
}) {
  const palette = useThemePalette();
  const [width, setWidth] = useState(0);

  const days = useMemo(() => {
    const list: { index: number; key: string; value: number | null }[] = [];
    let index = 0;
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= daysInMonth(year, m); d++) {
        const key = dateKey(year, m, d);
        list.push({ index, key, value: qualityByDay.has(key) ? (qualityByDay.get(key) as number) : null });
        index += 1;
      }
    }
    return list;
  }, [year, qualityByDay]);

  const monthStarts = useMemo(() => {
    const starts: { label: string; index: number }[] = [];
    let index = 0;
    for (let m = 0; m < 12; m++) {
      starts.push({ label: MONTH_INITIALS[m], index: index + daysInMonth(year, m) / 2 });
      index += daysInMonth(year, m);
    }
    return starts;
  }, [year]);

  const hasData = useMemo(() => days.some((d) => d.value != null), [days]);

  const n = days.length;
  const plotW = Math.max(1, width - 2 * PAD_X);
  const plotTop = PAD_Y;
  const plotBottom = H - PAD_Y;
  const zeroY = (plotTop + plotBottom) / 2;
  const halfH = zeroY - plotTop;
  const xFor = (i: number) => PAD_X + (n > 1 ? (i / (n - 1)) * plotW : 0);
  const barW = Math.max(1.5, plotW / n);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Interaction Quality</Text>
      <Text style={styles.subtitle}>Average quality of that day's interactions, 1 to 5 (3 = neutral).</Text>

      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: H }}>
        {width > 0 ? (
          <Svg width={width} height={H}>
            {days
              .filter((d) => d.value != null && d.value !== QUALITY_NEUTRAL)
              .map((d) => {
                const diff = (d.value as number) - QUALITY_NEUTRAL;
                const barH = (Math.abs(diff) / MAX_ABS) * halfH;
                const y = diff > 0 ? zeroY - barH : zeroY;
                return (
                  <Rect
                    key={d.key}
                    x={xFor(d.index) - barW / 2}
                    y={y}
                    width={barW}
                    height={barH}
                    fill={diff > 0 ? palette.accent : palette.danger}
                    rx={Math.min(1.5, barW / 2)}
                  />
                );
              })}
            {/* neutral line */}
            <Line x1={PAD_X} y1={zeroY} x2={width - PAD_X} y2={zeroY} stroke={palette.textMuted} strokeWidth={1} />
            <SvgText x={PAD_X} y={plotTop + 2} fill={palette.accent} fontSize={9} fontFamily={CHART_FONT}>
              {QUALITY_MAX}
            </SvgText>
            <SvgText x={PAD_X} y={plotBottom} fill={palette.danger} fontSize={9} fontFamily={CHART_FONT}>
              {QUALITY_MIN}
            </SvgText>
            {monthStarts.map((mo, i) => (
              <SvgText key={i} x={xFor(mo.index)} y={H - 2} fill={palette.textMuted} fontSize={9} fontFamily={CHART_FONT} textAnchor="middle">
                {mo.label}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>

      {!hasData ? <Text style={styles.note}>No interactions logged in {year} yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing(4),
    marginTop: theme.spacing(4),
  },
  title: { color: theme.color.textPrimary, fontSize: theme.font.subtitle, fontWeight: "700" },
  subtitle: { color: theme.color.textSecondary, fontSize: theme.font.caption, marginTop: 2, marginBottom: theme.spacing(2) },
  note: { color: theme.color.textMuted, fontSize: theme.font.caption, marginTop: theme.spacing(2), textAlign: "center" },
});
