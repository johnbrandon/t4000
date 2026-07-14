import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Chip from "../../components/Chip";
import StatCard from "../../components/StatCard";
import AppointmentsChart from "../../components/AppointmentsChart";
import DailyBarChart from "../../components/DailyBarChart";
import QualityChart from "../../components/QualityChart";
import YearGrid from "../../components/YearGrid";
import YieldLineChart, { type YieldStatus } from "../../components/YieldLineChart";
import { localDayKey, summarizeByDay, type DaySummary } from "../../lib/dayGrid";
import { useCheckIns, useSettings } from "../../lib/hooks";
import { TEMP_MAX_C, TEMP_MIN_C, tempToColor, theme } from "../../lib/theme";
import { formatDuration } from "../../lib/time";
import { fetchTreasuryYields } from "../../lib/treasury";
import { fetchDailyWeather, formatTemperature } from "../../lib/weather";

// Default reference location for backfilling temperature on days without a
// check-in (New York, NY).
const BACKFILL_LAT = 40.75581;
const BACKFILL_LON = -73.97182;

export default function YearScreen() {
  const { checkIns } = useCheckIns();
  const { settings } = useSettings();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [yields, setYields] = useState<Map<string, number>>(new Map());
  const [yieldStatus, setYieldStatus] = useState<YieldStatus>("loading");
  const [backfillTemps, setBackfillTemps] = useState<Map<string, number>>(new Map());
  const [precip, setPrecip] = useState<Map<string, number>>(new Map());

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

  useEffect(() => {
    let cancelled = false;
    fetchDailyWeather(BACKFILL_LAT, BACKFILL_LON, year).then((w) => {
      if (cancelled) return;
      setBackfillTemps(w.meanTempC);
      setPrecip(w.precipMm);
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

  // Count buyer/seller check-ins per day for the appointments chart.
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checkIns) {
      if (!c.activityTypes.includes("Buyer") && !c.activityTypes.includes("Seller")) continue;
      const date = new Date(c.createdAt);
      if (date.getFullYear() !== year) continue;
      const key = localDayKey(date);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [checkIns, year]);

  // Average interaction quality per day for the quality chart.
  const qualityByDay = useMemo(() => {
    const sums = new Map<string, { total: number; count: number }>();
    for (const c of checkIns) {
      const date = new Date(c.createdAt);
      if (date.getFullYear() !== year) continue;
      const key = localDayKey(date);
      const entry = sums.get(key) ?? { total: 0, count: 0 };
      entry.total += c.quality;
      entry.count += 1;
      sums.set(key, entry);
    }
    const avg = new Map<string, number>();
    for (const [key, { total, count }] of sums) avg.set(key, total / count);
    return avg;
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

  const selectedSummary: DaySummary | null = selectedDate ? dayData.get(selectedDate) ?? null : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>This Year</Text>
        <Text style={styles.subtitle}>
          Every square is a day of {year} (months across, days down). The more buyer & seller
          interactions you log that day, the darker the shade of green — in the style of GitHub
          contributions.
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
          />
        </View>

        <QualityChart year={year} qualityByDay={qualityByDay} />

        <DailyBarChart
          year={year}
          data={backfillTemps}
          title="Average Temperature"
          subtitle={`Daily average temperature at the default location, ${year}.`}
          domainMin={TEMP_MIN_C}
          domainMax={TEMP_MAX_C}
          colorFor={(v) => tempToColor(v)}
          formatTop={() => formatTemperature(TEMP_MAX_C, settings.temperatureUnit)}
          emptyNote="Temperature data unavailable right now."
        />

        <DailyBarChart
          year={year}
          data={precip}
          title="Rainfall"
          subtitle={`Total daily precipitation at the default location, ${year}.`}
          domainMin={0}
          domainMax={null}
          colorFor={() => theme.color.accentBlue}
          formatTop={(max) => `${Math.round(max)} mm`}
          emptyNote="Rainfall data unavailable right now."
        />

        <YieldLineChart year={year} yields={yields} status={yieldStatus} />
        <AppointmentsChart year={year} appointmentsByDay={appointmentsByDay} />

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
                • {c.activityTypes.join(", ")}
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
    fontFamily: theme.font.display,
    fontSize: theme.font.hero,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
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
