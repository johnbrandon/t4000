import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { dateKey, daysInMonth, MONTH_LABELS } from "../lib/dayGrid";
import { theme } from "../lib/theme";

const HEIGHT = 180;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const PAD_X = 6;

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
      starts.push({ label: MONTH_LABELS[m], index });
      index += daysInMonth(year, m);
    }
    return starts;
  }, [year]);

  const totalAppointments = useMemo(
    () => [...appointmentsByDay.values()].reduce((a, b) => a + b, 0),
    [appointmentsByDay]
  );

  function handleLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const n = days.length;
  const plotLeft = PAD_X;
  const plotRight = width - PAD_X;
  const plotTop = PAD_TOP;
  const plotBottom = HEIGHT - PAD_BOTTOM;
  const plotW = Math.max(1, plotRight - plotLeft);
  const plotH = Math.max(1, plotBottom - plotTop);

  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const yieldValues = days.map((d) => d.yield).filter((v): v is number => v != null);
  const minYield = yieldValues.length ? Math.min(...yieldValues) : 0;
  const maxYield = yieldValues.length ? Math.max(...yieldValues) : 1;
  const yieldSpan = maxYield - minYield || 1;

  const xFor = (i: number) => plotLeft + (n > 1 ? (i / (n - 1)) * plotW : 0);
  const yForCount = (c: number) => plotBottom - (c / maxCount) * plotH;
  const yForYield = (v: number) => plotBottom - ((v - minYield) / yieldSpan) * plotH;

  const barW = Math.max(2, plotW / n);

  const yieldLine = useMemo(() => {
    if (!width || !yieldValues.length) return "";
    return days
      .filter((d) => d.yield != null)
      .map((d) => `${xFor(d.index).toFixed(1)},${yForYield(d.yield as number).toFixed(1)}`)
      .join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, width, yieldValues.length, minYield, maxYield]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>10-Year Treasury vs. Buyer/Seller Appointments</Text>
      <Text style={styles.subtitle}>
        Bars are buyer/seller check-ins per day; the line is that day's 10-year Treasury yield.
      </Text>

      <View onLayout={handleLayout} style={styles.plot}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {/* baseline */}
            <Line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke={theme.color.border} strokeWidth={1} />

            {/* month ticks + labels */}
            {monthStarts.map((mo) => (
              <SvgText
                key={mo.label}
                x={xFor(mo.index)}
                y={HEIGHT - 8}
                fill={theme.color.textMuted}
                fontSize={9}
              >
                {mo.label}
              </SvgText>
            ))}

            {/* appointment bars */}
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
                    height={plotBottom - y}
                    fill={theme.color.accentBlue}
                    rx={1}
                  />
                );
              })}

            {/* yield line */}
            {yieldLine ? (
              <Polyline points={yieldLine} fill="none" stroke={theme.color.warning} strokeWidth={1.5} />
            ) : null}

            {/* axis value labels */}
            <SvgText x={plotLeft} y={plotTop - 2} fill={theme.color.accentBlue} fontSize={9}>
              {`${maxCount} appt`}
            </SvgText>
            {yieldValues.length ? (
              <SvgText x={plotRight} y={plotTop - 2} fill={theme.color.warning} fontSize={9} textAnchor="end">
                {`${maxYield.toFixed(1)}%`}
              </SvgText>
            ) : null}
          </Svg>
        ) : null}
      </View>

      {status === "loading" ? (
        <Text style={styles.note}>Loading Treasury yields…</Text>
      ) : status === "error" || yieldValues.length === 0 ? (
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
    marginBottom: theme.spacing(3),
  },
  plot: {
    width: "100%",
    height: HEIGHT,
  },
  note: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    marginTop: theme.spacing(2),
    textAlign: "center",
  },
});
