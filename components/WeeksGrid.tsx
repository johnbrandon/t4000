import { memo, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../lib/theme";
import type { WeekSummary } from "../lib/weeksGrid";

const WEEKS_PER_ROW = 52;
const GAP = 2;
const MIN_CELL = 3;
const MAX_CELL = 7;

function opacityForCount(count: number): number {
  return Math.min(1, 0.35 + count * 0.22);
}

const WeeksGrid = memo(function WeeksGrid({
  totalWeeks,
  weeksLived,
  weekData,
  onSelectWeek,
}: {
  totalWeeks: number;
  weeksLived: number;
  weekData: Map<number, WeekSummary>;
  onSelectWeek?: (weekIndex: number) => void;
}) {
  const [containerWidth, setContainerWidth] = useState(0);

  const cellSize = useMemo(() => {
    if (!containerWidth) return MIN_CELL;
    const available = containerWidth - (WEEKS_PER_ROW - 1) * GAP;
    const size = Math.floor(available / WEEKS_PER_ROW);
    return Math.max(MIN_CELL, Math.min(MAX_CELL, size));
  }, [containerWidth]);

  const rows = Math.ceil(totalWeeks / WEEKS_PER_ROW);

  const grid = useMemo(() => {
    const result: number[][] = [];
    let cursor = 0;
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < WEEKS_PER_ROW; c++) {
        row.push(cursor < totalWeeks ? cursor : -1);
        cursor++;
      }
      result.push(row);
    }
    return result;
  }, [rows, totalWeeks]);

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={styles.grid} onLayout={handleLayout}>
      {containerWidth > 0
        ? grid.map((row, r) => (
            <View key={r} style={[styles.row, { marginBottom: GAP }]}>
              {row.map((weekIndex, c) => {
                const cellDims = { width: cellSize, height: cellSize, marginRight: GAP };
                if (weekIndex === -1) return <View key={c} style={cellDims} />;
                const summary = weekData.get(weekIndex);
                const isPast = weekIndex < weeksLived;
                const isCurrent = weekIndex === weeksLived;

                const cellStyle = [
                  styles.cell,
                  cellDims,
                  {
                    backgroundColor: summary
                      ? summary.color
                      : isPast
                      ? theme.color.surfaceRaised
                      : "transparent",
                    opacity: summary ? opacityForCount(summary.count) : 1,
                    borderColor: isCurrent ? theme.color.accent : theme.color.border,
                    borderWidth: isCurrent ? 1.5 : summary ? 0 : 1,
                  },
                ];

                if (!onSelectWeek) {
                  return <View key={c} style={cellStyle} />;
                }
                return (
                  <Pressable key={c} style={cellStyle} onPress={() => onSelectWeek(weekIndex)} hitSlop={2} />
                );
              })}
            </View>
          ))
        : null}
      <Legend />
    </View>
  );
});

function Legend() {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendSwatch, { backgroundColor: theme.color.surfaceRaised }]} />
      <Text style={styles.legendLabel}>lived</Text>
      <View style={[styles.legendSwatch, { backgroundColor: theme.color.accent }]} />
      <Text style={styles.legendLabel}>checked in</Text>
      <View style={[styles.legendSwatch, { borderWidth: 1, borderColor: theme.color.border }]} />
      <Text style={styles.legendLabel}>ahead</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    alignItems: "flex-start",
    width: "100%",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    borderRadius: 1,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing(4),
    flexWrap: "wrap",
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    marginRight: theme.spacing(3),
  },
});

export default WeeksGrid;
