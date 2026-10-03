import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Chip from "../../components/Chip";
import DailyBarChart from "../../components/DailyBarChart";
import YearGrid from "../../components/YearGrid";
import YieldLineChart, { type YieldStatus } from "../../components/YieldLineChart";
import { summarizeByDay, trailingYearWindow, type DaySummary } from "../../lib/dayGrid";
import { useThemePalette } from "../../lib/ThemeContext";
import { useCheckIns, useSettings } from "../../lib/hooks";
import { TEMP_MAX_C, TEMP_MIN_C, theme } from "../../lib/theme";
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
  const palette = useThemePalette();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [yields, setYields] = useState<Map<string, number>>(new Map());
  const [yieldStatus, setYieldStatus] = useState<YieldStatus>("loading");
  const [backfillTemps, setBackfillTemps] = useState<Map<string, number>>(new Map());
  const [precip, setPrecip] = useState<Map<string, number>>(new Map());

  // The temperature, rainfall, and treasury charts show a rolling 12-month window
  // (independent of the grid's year selector), which spans the current and prior
  // calendar year — so we fetch both and merge.
  const chartWindow = useMemo(() => trailingYearWindow(), []);

  useEffect(() => {
    let cancelled = false;
    setYieldStatus("loading");
    Promise.all([fetchTreasuryYields(currentYear), fetchTreasuryYields(currentYear - 1)])
      .then(([thisYear, lastYear]) => {
        if (cancelled) return;
        const merged = new Map([...lastYear, ...thisYear]);
        setYields(merged);
        setYieldStatus(merged.size > 0 ? "ready" : "error");
      })
      .catch(() => {
        if (!cancelled) setYieldStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchDailyWeather(BACKFILL_LAT, BACKFILL_LON, currentYear),
      fetchDailyWeather(BACKFILL_LAT, BACKFILL_LON, currentYear - 1),
    ]).then(([thisYear, lastYear]) => {
      if (cancelled) return;
      setBackfillTemps(new Map([...lastYear.meanTempC, ...thisYear.meanTempC]));
      setPrecip(new Map([...lastYear.precipMm, ...thisYear.precipMm]));
    });
    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    for (const c of checkIns) set.add(new Date(c.createdAt).getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [checkIns, currentYear]);

  const dayData = useMemo(() => summarizeByDay(checkIns, year), [checkIns, year]);

  const selectedSummary: DaySummary | null = selectedDate ? dayData.get(selectedDate) ?? null : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>This Year</Text>

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

        <View style={styles.gridCard}>
          <YearGrid
            year={year}
            dayData={dayData}
            selectedDate={selectedDate}
            onSelectDay={setSelectedDate}
          />
        </View>

        <DailyBarChart
          window={chartWindow}
          data={backfillTemps}
          title="Average Temperature"
          subtitle="Daily average temperature at the default location, trailing 12 months."
          domainMin={TEMP_MIN_C}
          domainMax={TEMP_MAX_C}
          colorFor={(v) => palette.tempColor(v)}
          formatTop={() => formatTemperature(TEMP_MAX_C, settings.temperatureUnit)}
          emptyNote="Temperature data unavailable right now."
        />

        <DailyBarChart
          window={chartWindow}
          data={precip}
          title="Rainfall"
          subtitle="Total daily precipitation at the default location, trailing 12 months."
          domainMin={0}
          domainMax={null}
          colorFor={() => palette.accentBlue}
          formatTop={(max) => `${Math.round(max)} mm`}
          emptyNote="Rainfall data unavailable right now."
        />

        <YieldLineChart window={chartWindow} yields={yields} status={yieldStatus} />

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
    fontSize: theme.font.hero,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: theme.spacing(4),
  },
  yearRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
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
