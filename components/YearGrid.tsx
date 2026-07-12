import { memo, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { dateKey, daysInMonth, localDayKey, MONTH_INITIALS, type DaySummary } from "../lib/dayGrid";
import { TEMP_MAX_C, TEMP_MIN_C, tempToColor, theme } from "../lib/theme";
import { formatTemperature } from "../lib/weather";

const GAP = 3;
const DAY_LABEL_W = 22;
const MIN_CELL = 13;
const MAX_CELL = 26;
const MONTHS = 12;
const MAX_DAYS = 31;

const YearGrid = memo(function YearGrid({
  year,
  dayData,
  backfillTemps,
  onSelectDay,
  selectedDate,
  temperatureUnit,
}: {
  year: number;
  dayData: Map<string, DaySummary>;
  backfillTemps?: Map<string, number>;
  onSelectDay?: (date: string) => void;
  selectedDate?: string | null;
  temperatureUnit: "C" | "F";
}) {
  const now = useMemo(() => new Date(), []);
  const todayKey = localDayKey(now);
  const [width, setWidth] = useState(0);

  const cell = useMemo(() => {
    if (!width) return MIN_CELL;
    const available = width - DAY_LABEL_W - MONTHS * GAP;
    return Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(available / MONTHS)));
  }, [width]);

  function handleLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const colW = cell + GAP;

  return (
    <View onLayout={handleLayout}>
      {width > 0 ? (
        <View>
          {/* Month labels (first letter only) */}
          <View style={[styles.row, { marginLeft: DAY_LABEL_W }]}>
            {MONTH_INITIALS.map((label, m) => (
              <View key={m} style={{ width: colW, alignItems: "center" }}>
                <Text style={styles.monthLabel} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* 31 day rows */}
          {Array.from({ length: MAX_DAYS }, (_, r) => {
            const day = r + 1;
            return (
              <View key={day} style={styles.row}>
                <View style={{ width: DAY_LABEL_W, height: cell }}>
                  {day % 5 === 0 || day === 1 ? <Text style={styles.dayLabel}>{day}</Text> : null}
                </View>
                {Array.from({ length: MONTHS }, (_, m) => {
                  const dims = { width: cell, height: cell, marginRight: GAP, borderRadius: 2 };
                  if (day > daysInMonth(year, m)) {
                    return <View key={m} style={{ width: cell, height: cell, marginRight: GAP }} />;
                  }
                  const key = dateKey(year, m, day);
                  const summary = dayData.get(key);
                  const isToday = key === todayKey;
                  const isSelected = key === selectedDate;
                  const isFuture = key > todayKey;

                  // Prefer the day's recorded check-in temperature; otherwise
                  // backfill non-check-in days with the historical daily mean.
                  const backfill = backfillTemps?.get(key);
                  let backgroundColor: string;
                  if (summary?.avgTempC != null) backgroundColor = tempToColor(summary.avgTempC);
                  else if (summary) backgroundColor = theme.color.textMuted; // checked in, no temp
                  else if (!isFuture && backfill != null) backgroundColor = tempToColor(backfill);
                  else if (isFuture) backgroundColor = "transparent";
                  else backgroundColor = theme.color.surfaceRaised;

                  const cellStyle = [
                    dims,
                    {
                      backgroundColor,
                      borderColor: isSelected
                        ? theme.color.textPrimary
                        : isToday
                        ? theme.color.accent
                        : isFuture && !summary
                        ? theme.color.border
                        : "transparent",
                      borderWidth: isSelected || isToday ? 1.5 : isFuture && !summary ? 1 : 0,
                    },
                  ];

                  if (!onSelectDay) return <View key={m} style={cellStyle} />;
                  return <Pressable key={m} style={cellStyle} onPress={() => onSelectDay(key)} hitSlop={1} />;
                })}
              </View>
            );
          })}

          <Legend temperatureUnit={temperatureUnit} />
        </View>
      ) : null}
    </View>
  );
});

function Legend({ temperatureUnit }: { temperatureUnit: "C" | "F" }) {
  const steps = 10;
  return (
    <View style={styles.legend}>
      <Text style={styles.legendLabel}>{formatTemperature(TEMP_MIN_C, temperatureUnit)}</Text>
      <View style={styles.legendBar}>
        {Array.from({ length: steps }, (_, i) => {
          const c = TEMP_MIN_C + ((TEMP_MAX_C - TEMP_MIN_C) * i) / (steps - 1);
          return <View key={i} style={[styles.legendSwatch, { backgroundColor: tempToColor(c) }]} />;
        })}
      </View>
      <Text style={styles.legendLabel}>{formatTemperature(TEMP_MAX_C, temperatureUnit)}</Text>
      <View style={[styles.legendGray, { backgroundColor: theme.color.textMuted }]} />
      <Text style={styles.legendLabel}>no temp</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: GAP,
    alignItems: "center",
  },
  monthLabel: {
    color: theme.color.textMuted,
    fontSize: 9,
  },
  dayLabel: {
    color: theme.color.textMuted,
    fontSize: 9,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing(4),
    flexWrap: "wrap",
    gap: 4,
  },
  legendBar: {
    flexDirection: "row",
  },
  legendSwatch: {
    width: 10,
    height: 11,
  },
  legendGray: {
    width: 11,
    height: 11,
    borderRadius: 2,
    marginLeft: theme.spacing(2),
  },
  legendLabel: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
  },
});

export default YearGrid;
