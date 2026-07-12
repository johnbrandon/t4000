import { useMemo, useState } from "react";
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Polyline, Stop, Text as SvgText } from "react-native-svg";
import { dateKey, daysInMonth, localDayKey, MONTH_INITIALS } from "../lib/dayGrid";
import { theme } from "../lib/theme";

const CHART_FONT = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" : undefined;
const H = 150;
const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 20;
const COLOR = theme.color.warning;

export type YieldStatus = "loading" | "ready" | "error";

export default function YieldLineChart({
  year,
  yields,
  status,
}: {
  year: number;
  yields: Map<string, number>;
  status: YieldStatus;
}) {
  const [width, setWidth] = useState(0);
  const todayKey = localDayKey(new Date());

  // Carry the last known yield forward so weekends/holidays are filled and the
  // line covers every day up to today; future days stay null.
  const days = useMemo(() => {
    const list: { index: number; key: string; yield: number | null }[] = [];
    let index = 0;
    let last: number | null = null;
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= daysInMonth(year, m); d++) {
        const key = dateKey(year, m, d);
        const raw = yields.get(key);
        let value: number | null = null;
        if (typeof raw === "number") {
          value = raw;
          last = raw;
        } else if (last != null && key <= todayKey) {
          value = last;
        }
        list.push({ index, key, yield: value });
        index += 1;
      }
    }
    return list;
  }, [year, yields, todayKey]);

  const monthStarts = useMemo(() => {
    const starts: { label: string; index: number }[] = [];
    let index = 0;
    for (let m = 0; m < 12; m++) {
      starts.push({ label: MONTH_INITIALS[m], index: index + daysInMonth(year, m) / 2 });
      index += daysInMonth(year, m);
    }
    return starts;
  }, [year]);

  const n = days.length;
  const plotW = Math.max(1, width - 2 * PAD_X);
  const plotBottom = H - PAD_BOTTOM;
  const xFor = (i: number) => PAD_X + (n > 1 ? (i / (n - 1)) * plotW : 0);

  const values = days.map((d) => d.yield).filter((v): v is number => v != null);
  const hasData = values.length > 0;
  const rawMin = hasData ? Math.min(...values) : 0;
  const rawMax = hasData ? Math.max(...values) : 1;
  const pad = (rawMax - rawMin) * 0.15 || 0.2;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;
  const yFor = (v: number) => plotBottom - ((v - yMin) / (yMax - yMin || 1)) * (plotBottom - PAD_TOP);

  const linePoints = days.filter((d) => d.yield != null).map((d) => `${xFor(d.index).toFixed(1)},${yFor(d.yield as number).toFixed(1)}`);
  const areaPath =
    linePoints.length > 1
      ? `M ${linePoints[0].split(",")[0]},${plotBottom} L ${linePoints.join(" L ")} L ${
          linePoints[linePoints.length - 1].split(",")[0]
        },${plotBottom} Z`
      : "";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>10-Year Treasury Yield</Text>
      <Text style={styles.subtitle}>Daily 10-year Treasury constant-maturity yield, {year}.</Text>

      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: H }}>
        {width > 0 && hasData ? (
          <Svg width={width} height={H}>
            <Defs>
              <LinearGradient id="yieldFill2" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLOR} stopOpacity={0.28} />
                <Stop offset="1" stopColor={COLOR} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {areaPath ? <Path d={areaPath} fill="url(#yieldFill2)" /> : null}
            <Polyline points={linePoints.join(" ")} fill="none" stroke={COLOR} strokeWidth={1.75} />
            <SvgText x={width - PAD_X} y={PAD_TOP + 6} fill={theme.color.textMuted} fontSize={9} fontFamily={CHART_FONT} textAnchor="end">
              {`${rawMax.toFixed(2)}%`}
            </SvgText>
            <SvgText x={width - PAD_X} y={plotBottom} fill={theme.color.textMuted} fontSize={9} fontFamily={CHART_FONT} textAnchor="end">
              {`${rawMin.toFixed(2)}%`}
            </SvgText>
            {monthStarts.map((mo, i) => (
              <SvgText key={i} x={xFor(mo.index)} y={H - 4} fill={theme.color.textMuted} fontSize={9} fontFamily={CHART_FONT} textAnchor="middle">
                {mo.label}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>

      {status === "loading" ? (
        <Text style={styles.note}>Loading Treasury yields…</Text>
      ) : status === "error" || !hasData ? (
        <Text style={styles.note}>Treasury yields unavailable right now.</Text>
      ) : null}
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
