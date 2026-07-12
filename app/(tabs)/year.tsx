import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Chip from "../../components/Chip";
import StatCard from "../../components/StatCard";
import YearGrid from "../../components/YearGrid";
import YieldChart, { type YieldStatus } from "../../components/YieldChart";
import { localDayKey, summarizeByDay, type DaySummary } from "../../lib/dayGrid";
import { useCheckIns, useSettings } from "../../lib/hooks";
import { TEMP_MAX_C, TEMP_MIN_C, theme } from "../../lib/theme";
import { formatDuration } from "../../lib/time";
import { fetchTreasuryYields } from "../../lib/treasury";

export default function YearScreen() {
  const { checkIns } = useCheckIns();
  const { settings } = useSettings();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [yields, setYields] = useState<Map<string, number>>(new Map());
  const [yieldStatus, setYieldStatus] = useState<YieldStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    setYieldStatus("loading");
    fetchTreasuryYields(year)
      .then((map) => {
        if (cancelled) return;
        setYields(map);
        setYieldStatus(map.size > 0 ? "ready" : "error");
      })
      .catch(() => {
        if (!cancelled) setYieldStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    for (const c of checkIns) set.add(new Date(c.createdAt).getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [checkIns, currentYear]);

  const dayData = useMemo(() => summarizeByDay(checkIns, year), [checkIns, year]);

  // Count buyer/seller check-ins per day for the appointment-vs-yield chart.
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checkIns) {
      if (c.activityType !== "Buyer" && c.activityType !== "Seller") continue;
      const date = new Date(c.createdAt);
      if (date.getFullYear() !== year) continue;
      const key = localDayKey(date);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [checkIns, year]);

  const yearStats = useMemo(() => {
    let totalMinutes = 0;
    let checkInCount = 0;
    for (const summary of dayData.values()) {
      totalMinutes += summary.totalMinutes;
      checkInCount += summary.count;
    }
    return { activeDays: dayData.size, totalMinutes, checkInCount };
  }, [dayData]);

  // Fit the temperature gradient to the year's actual range so the full
  // blue→red spread is used (strong contrast), with a floor so a mild year
  // still shows variation.
  const tempDomain = useMemo(() => {
    const temps = [...dayData.values()].map((d) => d.avgTempC).filter((v): v is number => v != null);
    if (temps.length < 2) return { min: TEMP_MIN_C, max: TEMP_MAX_C };
    let min = Math.min(...temps);
    let max = Math.max(...temps);
    const MIN_SPAN = 6;
    if (max - min < MIN_SPAN) {
      const mid = (min + max) / 2;
      min = mid - MIN_SPAN / 2;
      max = mid + MIN_SPAN / 2;
    }
    return { min, max };
  }, [dayData]);

  const selectedSummary: DaySummary | null = selectedDate ? dayData.get(selectedDate) ?? null : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>This Year</Text>
        <Text style={styles.subtitle}>
          Every square is a day of {year} (months across, days down), shaded by that day's average
          temperature — blue is cold, red is hot.
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
        </View>

        <View style={styles.gridCard}>
          <YearGrid
            year={year}
            dayData={dayData}
            selectedDate={selectedDate}
            onSelectDay={setSelectedDate}
            temperatureUnit={settings.temperatureUnit}
            tempMin={tempDomain.min}
            tempMax={tempDomain.max}
          />
        </View>

        <YieldChart
          year={year}
          appointmentsByDay={appointmentsByDay}
          yields={yields}
          status={yieldStatus}
        />

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
