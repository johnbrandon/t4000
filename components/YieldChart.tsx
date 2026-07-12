import { useMemo, useState } from "react";
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Polyline, Rect, Stop, Text as SvgText } from "react-native-svg";
import { dateKey, daysInMonth, MONTH_INITIALS } from "../lib/dayGrid";
import { theme } from "../lib/theme";

// Match the app's sans-serif UI font (SVG text otherwise defaults to serif on web).
const CHART_FONT = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" : undefined;

const YIELD_H = 116;
const APPT_H = 92;
const PAD_X = 8;
const YIELD_COLOR = theme.color.warning; // single series
const APPT_COLOR = theme.color.accentBlue; // single series

export type YieldStatus = "loading" | "ready" | "error";

export default function YieldChart({
  year,
  appointmentsByDay,
  yields,
  status,
}: {
  year: number;
  appointmentsByDay: Map<string, number>;
  yields: Map<string, number>;
  status: YieldStatus;
}) {
  const [width, setWidth] = useState(0);

  const days = useMemo(() => {
    const list: { index: number; key: string; count: number; yield: number | null }[] = [];
    let index = 0;
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= daysInMonth(year, m); d++) {
        const key = dateKey(year, m, d);
        list.push({ index, key, count: appointmentsByDay.get(key) ?? 0, yield: yields.get(key) ?? null });
        index += 1;
      }
    }
    return list;
  }, [year, appointmentsByDay, yields]);

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
  const xFor = (i: number) => PAD_X + (n > 1 ? (i / (n - 1)) * plotW : 0);

  const yieldValues = days.map((d) => d.yield).filter((v): v is number => v != null);
  const hasYield = yieldValues.length > 0;
  const rawMin = hasYield ? Math.min(...yieldValues) : 0;
  const rawMax = hasYield ? Math.max(...yieldValues) : 1;
  const pad = (rawMax - rawMin) * 0.15 || 0.2;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const totalAppointments = useMemo(
    () => [...appointmentsByDay.values()].reduce((a, b) => a + b, 0),
    [appointmentsByDay]
  );

  // --- yield panel geometry ---
  const yTop = 8;
  const yBottom = YIELD_H - 8;
  const yForYield = (v: number) => yBottom - ((v - yMin) / (yMax - yMin || 1)) * (yBottom - yTop);

  const linePoints = days.filter((d) => d.yield != null).map((d) => `${xFor(d.index).toFixed(1)},${yForYield(d.yield as number).toFixed(1)}`);
  const areaPath =
    linePoints.length > 1
      ? `M ${linePoints[0].split(",")[0]},${yBottom} L ${linePoints.join(" L ")} L ${
          linePoints[linePoints.length - 1].split(",")[0]
        },${yBottom} Z`
      : "";

  // --- appointments panel geometry ---
  const aTop = 8;
  const aBottom = APPT_H - 18;
  const yForCount = (c: number) => aBottom - (c / maxCount) * (aBottom - aTop);
  const barW = Math.max(2.5, plotW / n);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>10-Year Treasury vs. Buyer/Seller Appointments</Text>
      <Text style={styles.subtitle}>
        The daily 10-year Treasury yield is plotted for every day; bars below count buyer/seller check-ins.
      </Text>

      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <>
            <Text style={[styles.panelLabel, { color: YIELD_COLOR }]}>10-yr Treasury yield</Text>
            <Svg width={width} height={YIELD_H}>
              <Defs>
                <LinearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={YIELD_COLOR} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={YIELD_COLOR} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {hasYield ? (
                <>
                  {areaPath ? <Path d={areaPath} fill="url(#yieldFill)" /> : null}
                  <Polyline points={linePoints.join(" ")} fill="none" stroke={YIELD_COLOR} strokeWidth={1.75} />
                  <SvgText x={width - PAD_X} y={yTop + 8} fill={theme.color.textMuted} fontSize={9} fontFamily={CHART_FONT} textAnchor="end">
                    {`${rawMax.toFixed(2)}%`}
                  </SvgText>
                  <SvgText x={width - PAD_X} y={yBottom} fill={theme.color.textMuted} fontSize={9} fontFamily={CHART_FONT} textAnchor="end">
                    {`${rawMin.toFixed(2)}%`}
                  </SvgText>
                </>
              ) : null}
            </Svg>

            <Text style={[styles.panelLabel, { color: APPT_COLOR }]}>Buyer / seller appointments</Text>
            <Svg width={width} height={APPT_H}>
              <Line x1={PAD_X} y1={aBottom} x2={width - PAD_X} y2={aBottom} stroke={theme.color.border} strokeWidth={1} />
              {days
                .filter((d) => d.count > 0)
                .map((d) => {
                  const y = yForCount(d.count);
                  return (
                    <Rect
                      key={d.key}
                      x={xFor(d.index) - barW / 2}
                      y={y}
                      width={barW}
                      height={aBottom - y}
                      fill={APPT_COLOR}
                      rx={Math.min(2, barW / 2)}
                    />
                  );
                })}
              <SvgText x={PAD_X} y={aTop + 4} fill={theme.color.textMuted} fontSize={9} fontFamily={CHART_FONT}>
                {`${maxCount}`}
              </SvgText>
              {monthStarts.map((mo, i) => (
                <SvgText
                  key={i}
                  x={xFor(mo.index)}
                  y={APPT_H - 4}
                  fill={theme.color.textMuted}
                  fontSize={9}
                  fontFamily={CHART_FONT}
                  textAnchor="middle"
                >
                  {mo.label}
                </SvgText>
              ))}
            </Svg>
          </>
        ) : null}
      </View>

      {status === "loading" ? (
        <Text style={styles.note}>Loading Treasury yields…</Text>
      ) : status === "error" || !hasYield ? (
        <Text style={styles.note}>Treasury yields unavailable right now.</Text>
      ) : totalAppointments === 0 ? (
        <Text style={styles.note}>No buyer or seller check-ins in {year} yet.</Text>
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
  title: {
    color: theme.color.textPrimary,
    fontSize: theme.font.subtitle,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.color.textSecondary,
    fontSize: theme.font.caption,
    marginTop: 2,
    marginBottom: theme.spacing(2),
  },
  panelLabel: {
    fontSize: theme.font.caption,
    fontWeight: "700",
    marginTop: theme.spacing(2),
  },
  note: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    marginTop: theme.spacing(2),
    textAlign: "center",
  },
});
