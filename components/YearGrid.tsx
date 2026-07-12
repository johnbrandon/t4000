import { memo, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { buildYearColumns, localDayKey, MONTH_LABELS, type DaySummary } from "../lib/dayGrid";
import { theme } from "../lib/theme";

const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;
const LABEL_W = 26;
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function opacityForCount(count: number): number {
  return Math.min(1, 0.4 + count * 0.2);
}

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
  const columns = useMemo(() => buildYearColumns(year, now), [year, now]);

  // Place each month's label above the first column that contains a day of it.
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    columns.forEach((column, col) => {
      const firstCell = column.find((c) => c !== null);
      if (!firstCell) return;
      const month = firstCell.day.getMonth();
      if (month !== lastMonth) {
        labels.push({ label: MONTH_LABELS[month], col });
        lastMonth = month;
      }
    });
    return labels;
  }, [columns]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View>
        {/* Month labels, absolutely positioned so they never wrap inside a column */}
        <View style={[styles.monthRow, { marginLeft: LABEL_W, width: columns.length * STEP }]}>
          {monthLabels.map(({ label, col }) => (
            <Text key={col} style={[styles.monthLabel, { left: col * STEP }]} numberOfLines={1}>
              {label}
            </Text>
          ))}
        </View>

        {/* Weekday labels + day columns */}
        <View style={styles.gridRow}>
          <View style={styles.weekdayColumn}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={styles.weekdayCell}>
                <Text style={styles.weekdayLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {columns.map((column, c) => (
            <View key={c}>
              {column.map((cell, r) => {
                if (!cell) return <View key={r} style={styles.spacer} />;
                const summary = dayData.get(cell.date);
                const isToday = cell.date === todayKey;
                const isSelected = cell.date === selectedDate;

                const cellStyle = [
                  styles.cell,
                  {
                    backgroundColor: summary
                      ? summary.color
                      : cell.isFuture
                      ? "transparent"
                      : theme.color.surfaceRaised,
                    opacity: summary ? opacityForCount(summary.count) : 1,
                    borderColor: isSelected
                      ? theme.color.textPrimary
                      : isToday
                      ? theme.color.accent
                      : cell.isFuture
                      ? theme.color.border
                      : "transparent",
                    borderWidth: isSelected || isToday ? 1.5 : cell.isFuture ? 1 : 0,
                  },
                ];

                if (!onSelectDay) return <View key={r} style={cellStyle} />;
                return <Pressable key={r} style={cellStyle} onPress={() => onSelectDay(cell.date)} hitSlop={2} />;
              })}
            </View>
          ))}
        </View>

        <Legend />
      </View>
    </ScrollView>
  );
});

function Legend() {
  return (
    <View style={[styles.legend, { marginLeft: LABEL_W }]}>
      <View style={[styles.legendSwatch, { backgroundColor: theme.color.surfaceRaised }]} />
      <Text style={styles.legendLabel}>no check-in</Text>
      <View style={[styles.legendSwatch, { backgroundColor: theme.color.accent }]} />
      <Text style={styles.legendLabel}>checked in</Text>
      <View style={[styles.legendSwatch, { borderWidth: 1.5, borderColor: theme.color.accent }]} />
      <Text style={styles.legendLabel}>today</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: theme.spacing(2),
  },
  monthRow: {
    height: 14,
    marginBottom: 4,
  },
  monthLabel: {
    position: "absolute",
    color: theme.color.textMuted,
    fontSize: 10,
  },
  gridRow: {
    flexDirection: "row",
  },
  weekdayColumn: {
    width: LABEL_W,
  },
  weekdayCell: {
    height: STEP,
    justifyContent: "center",
  },
  weekdayLabel: {
    color: theme.color.textMuted,
    fontSize: 9,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
    marginRight: GAP,
    marginBottom: GAP,
  },
  spacer: {
    width: CELL,
    height: CELL,
    marginRight: GAP,
    marginBottom: GAP,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing(3),
    flexWrap: "wrap",
    gap: 6,
  },
  legendSwatch: {
    width: 11,
    height: 11,
    borderRadius: 2,
  },
  legendLabel: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    marginRight: theme.spacing(3),
  },
});

export default YearGrid;
