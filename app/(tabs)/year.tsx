import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Chip from "../../components/Chip";
import StatCard from "../../components/StatCard";
import YearGrid from "../../components/YearGrid";
import { summarizeByDay, type DaySummary } from "../../lib/dayGrid";
import { useCheckIns } from "../../lib/hooks";
import { computeStats } from "../../lib/stats";
import { theme } from "../../lib/theme";
import { formatDuration } from "../../lib/time";

export default function YearScreen() {
  const { checkIns } = useCheckIns();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    for (const c of checkIns) set.add(new Date(c.createdAt).getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [checkIns, currentYear]);

  const dayData = useMemo(() => summarizeByDay(checkIns, year), [checkIns, year]);

  const yearStats = useMemo(() => {
    let totalMinutes = 0;
    let checkInCount = 0;
    for (const summary of dayData.values()) {
      totalMinutes += summary.totalMinutes;
      checkInCount += summary.count;
    }
    return { activeDays: dayData.size, totalMinutes, checkInCount };
  }, [dayData]);

  const streak = useMemo(() => computeStats(checkIns).currentStreakDays, [checkIns]);
  const selectedSummary: DaySummary | null = selectedDate ? dayData.get(selectedDate) ?? null : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>This Year</Text>
        <Text style={styles.subtitle}>
          Each square is a day of {year}. Days you checked in are colored by their main activity.
        </Text>

        {years.length > 1 ? (
          <View style={styles.yearRow}>
            {years.map((y) => (
              <Chip key={y} label={String(y)} selected={y === year} onPress={() => {
                setYear(y);
                setSelectedDate(null);
              }} />
            ))}
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard label="Days active" value={String(yearStats.activeDays)} accent={theme.color.accent} />
          <StatCard label="Check-ins" value={String(yearStats.checkInCount)} accent={theme.color.accentBlue} />
          <StatCard label="Streak" value={`${streak}d`} accent={theme.color.accentAlt} />
        </View>

        <View style={styles.gridCard}>
          <YearGrid year={year} dayData={dayData} selectedDate={selectedDate} onSelectDay={setSelectedDate} />
        </View>

        {selectedSummary ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{formatDayLabel(selectedSummary.date)}</Text>
              <Text style={styles.detailClose} onPress={() => setSelectedDate(null)}>
                Close
              </Text>
            </View>
            <Text style={styles.detailBody}>
              {selectedSummary.count} check-in{selectedSummary.count === 1 ? "" : "s"} ·{" "}
              {formatDuration(selectedSummary.totalMinutes)} · mostly {selectedSummary.dominantActivity}
            </Text>
            {selectedSummary.checkIns.map((c) => (
              <Text key={c.id} style={styles.detailLine}>
                • {c.activityType}
                {c.purpose ? ` — ${c.purpose}` : ""}
              </Text>
            ))}
          </View>
        ) : selectedDate ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{formatDayLabel(selectedDate)}</Text>
              <Text style={styles.detailClose} onPress={() => setSelectedDate(null)}>
                Close
              </Text>
            </View>
            <Text style={styles.detailBody}>No check-ins this day.</Text>
          </View>
        ) : (
          <Text style={styles.hint}>Tap a day to see what happened.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  content: {
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(16),
  },
  title: {
    color: theme.color.textPrimary,
    fontSize: theme.font.hero,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.color.textSecondary,
    fontSize: theme.font.body,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
  yearRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing(3),
    marginBottom: theme.spacing(5),
  },
  gridCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing(4),
  },
  hint: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    marginTop: theme.spacing(3),
    textAlign: "center",
  },
  detailCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing(4),
    marginTop: theme.spacing(3),
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailTitle: {
    color: theme.color.textPrimary,
    fontWeight: "800",
    fontSize: theme.font.subtitle,
    flexShrink: 1,
  },
  detailClose: {
    color: theme.color.accent,
    fontSize: theme.font.caption,
    fontWeight: "700",
    paddingLeft: theme.spacing(3),
  },
  detailBody: {
    color: theme.color.textSecondary,
    fontSize: theme.font.caption,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  detailLine: {
    color: theme.color.textSecondary,
    fontSize: theme.font.body,
    marginTop: 2,
  },
});
