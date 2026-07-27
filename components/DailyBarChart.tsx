import { useMemo, useState } from "react";
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { dateKey, daysInMonth, MONTH_INITIALS } from "../lib/dayGrid";
import { useThemePalette } from "../lib/ThemeContext";
import { theme } from "../lib/theme";

const CHART_FONT = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" : undefined;
const H = 120;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 20;

// A bar-per-day chart across a year (bars grow from the baseline up). Used for
// daily rainfall and average temperature.
export default function DailyBarChart({
  year,
  data,
  title,
  subtitle,
  domainMin,
  domainMax,
  colorFor,
  formatTop,
  emptyNote,
}: {
  year: number;
  data: Map<string, number>;
  title: string;
  subtitle: string;
  domainMin: number;
  domainMax: number | null; // null => scale to the data's max
  colorFor: (value: number) => string;
  formatTop: (max: number) => string;
  emptyNote?: string;
}) {
  const palette = useThemePalette();
  const [width, setWidth] = useState(0);

  const days = useMemo(() => {
    const list: { index: number; key: string; value: number | null }[] = [];
    let index = 0;
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= daysInMonth(year, m); d++) {
        const key = dateKey(year, m, d);
        list.push({ index, key, value: data.has(key) ? (data.get(key) as number) : null });
        index += 1;
      }
    }
    return list;
  }, [year, data]);

  const monthStarts = useMemo(() => {
    const starts: { label: string; index: number }[] = [];
    let index = 0;
    for (let m = 0; m < 12; m++) {
      starts.push({ label: MONTH_INITIALS[m], index: index + daysInMonth(year, m) / 2 });
      index += daysInMonth(year, m);
    }
    return starts;
  }, [year]);

  const values = days.map((d) => d.value).filter((v): v is number => v != null);
  const hasData = values.length > 0;
  const top = domainMax ?? Math.max(0.001, ...values);

  const n = days.length;
  const plotW = Math.max(1, width - 2 * PAD_X);
  const plotBottom = H - PAD_BOTTOM;
  const xFor = (i: number) => PAD_X + (n > 1 ? (i / (n - 1)) * plotW : 0);
  const yFor = (v: number) => {
    const t = Math.max(0, Math.min(1, (v - domainMin) / (top - domainMin || 1)));
    return plotBottom - t * (plotBottom - PAD_TOP);
  };
  const barW = Math.max(1.5, plotW / n);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: H }}>
        {width > 0 ? (
          <Svg width={width} height={H}>
            <Line x1={PAD_X} y1={plotBottom} x2={width - PAD_X} y2={plotBottom} stroke={palette.border} strokeWidth={1} />
            {days
              .filter((d) => d.value != null && (d.value as number) > domainMin)
              .map((d) => {
                const v = d.value as number;
                const y = yFor(v);
                return (
                  <Rect
                    key={d.key}
                    x={xFor(d.index) - barW / 2}
                    y={y}
                    width={barW}
                    height={plotBottom - y}
                    fill={colorFor(v)}
                    rx={Math.min(1.5, barW / 2)}
                  />
                );
              })}
            {hasData ? (
              <SvgText x={PAD_X} y={PAD_TOP} fill={palette.textMuted} fontSize={9} fontFamily={CHART_FONT}>
                {formatTop(top)}
              </SvgText>
            ) : null}
            {monthStarts.map((mo, i) => (
              <SvgText key={i} x={xFor(mo.index)} y={H - 4} fill={palette.textMuted} fontSize={9} fontFamily={CHART_FONT} textAnchor="middle">
                {mo.label}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>

      {!hasData && emptyNote ? <Text style={styles.note}>{emptyNote}</Text> : null}
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
