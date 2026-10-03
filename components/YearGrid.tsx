import { memo, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { dateKey, daysInMonth, localDayKey, MONTH_INITIALS, type DaySummary } from "../lib/dayGrid";
import { CONTRIBUTION_LEVELS, contributionColor, theme } from "../lib/theme";

const GAP = 3;
const DAY_LABEL_W = 22;
const MIN_CELL = 13;
const MAX_CELL = 26;
const MONTHS = 12;
const MAX_DAYS = 31;

const YearGrid = memo(function YearGrid({
  year,
  dayData,
  onSelectDay,
  selectedDate,
}: {
  year: number;
  dayData: Map<string, DaySummary>;
  onSelectDay?: (date: string) => void;
  selectedDate?: string | null;
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

                  // GitHub-contributions style: color by number of buyer/seller
                  // interactions logged that day — more interactions, darker green.
                  const backgroundColor = isFuture
                    ? "transparent"
                    : contributionColor(summary?.interactionCount ?? 0);

                  const cellStyle = [
                    dims,
                    {
                      backgroundColor,
                      borderColor: isSelected
                        ? theme.color.textPrimary
                        : isToday
                        ? theme.color.accent
                        : isFuture
                        ? theme.color.border
                        : "transparent",
                      borderWidth: isSelected || isToday ? 1.5 : isFuture ? 1 : 0,
                    },
                  ];

                  if (!onSelectDay) return <View key={m} style={cellStyle} />;
                  return <Pressable key={m} style={cellStyle} onPress={() => onSelectDay(key)} hitSlop={1} />;
                })}
              </View>
            );
          })}

          <Legend />
        </View>
      ) : null}
    </View>
  );
});

function Legend() {
  return (
    <View style={styles.legend}>
      <Text style={styles.legendLabel}>Less</Text>
      <View style={styles.legendBar}>
        {CONTRIBUTION_LEVELS.map((color, i) => (
          <View key={i} style={[styles.legendSwatch, { backgroundColor: color }]} />
        ))}
      </View>
      <Text style={styles.legendLabel}>More</Text>
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
    gap: 4,
  },
  legendBar: {
    flexDirection: "row",
    gap: 3,
  },
  legendSwatch: {
    width: 11,
    height: 11,
    borderRadius: 2,
  },
  legendLabel: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
  },
});

export default YearGrid;
