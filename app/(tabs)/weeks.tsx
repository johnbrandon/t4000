import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StatCard from "../../components/StatCard";
import WeeksGrid from "../../components/WeeksGrid";
import { useCheckIns, useSettings } from "../../lib/hooks";
import { theme } from "../../lib/theme";
import { formatDuration, parseBirthDate, weeksLived } from "../../lib/time";
import { summarizeByWeek, type WeekSummary } from "../../lib/weeksGrid";

export default function WeeksScreen() {
  const { checkIns } = useCheckIns();
  const { settings, loading } = useSettings();
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState<WeekSummary | null>(null);

  const birthDate = settings.birthDate ? parseBirthDate(settings.birthDate) : null;

  const weekData = useMemo(() => {
    if (!birthDate) return new Map<number, WeekSummary>();
    return summarizeByWeek(checkIns, birthDate);
  }, [checkIns, birthDate]);

  const lived = birthDate ? weeksLived(birthDate) : 0;
  const remaining = Math.max(0, settings.lifeExpectancyWeeks - lived);
  const percentLived = birthDate ? Math.min(100, (lived / settings.lifeExpectancyWeeks) * 100) : 0;

  if (loading) return <SafeAreaView style={styles.container} />;

  if (!birthDate) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.emptyState}>
          <Text style={styles.title}>4000 Weeks</Text>
          <Text style={styles.emptyBody}>
            Inspired by Oliver Burkeman's book on the ~4000 weeks of an average life, this grid fills in as you
            check in. Add your birth date to see it.
          </Text>
          <Pressable style={styles.cta} onPress={() => router.push("/profile")}>
            <Text style={styles.ctaLabel}>Set birth date</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>4000 Weeks</Text>
        <Text style={styles.subtitle}>Each square is a week of your life. Colored squares are weeks you checked in.</Text>

        <View style={styles.statsRow}>
          <StatCard label="Weeks lived" value={String(lived)} accent={theme.color.accentBlue} />
          <StatCard label="Weeks left" value={String(remaining)} accent={theme.color.accent} />
          <StatCard label="Life so far" value={`${percentLived.toFixed(1)}%`} accent={theme.color.accentAlt} />
        </View>

        <View style={styles.gridCard}>
          <WeeksGrid
            totalWeeks={settings.lifeExpectancyWeeks}
            weeksLived={lived}
            weekData={weekData}
            onSelectWeek={(weekIndex) => setSelectedWeek(weekData.get(weekIndex) ?? null)}
          />
        </View>

        {selectedWeek ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Week {selectedWeek.weekIndex + 1}</Text>
              <Pressable onPress={() => setSelectedWeek(null)}>
                <Text style={styles.detailClose}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.detailBody}>
              {selectedWeek.count} check-in{selectedWeek.count === 1 ? "" : "s"} · {formatDuration(selectedWeek.totalMinutes)}{" "}
              · mostly {selectedWeek.dominantActivity}
            </Text>
            {selectedWeek.checkIns.map((c) => (
              <Text key={c.id} style={styles.detailLine}>
                • {c.activityType}{c.purpose ? ` — ${c.purpose}` : ""}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>Tap a square to see what happened that week.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
  },
  detailClose: {
    color: theme.color.accent,
    fontSize: theme.font.caption,
    fontWeight: "700",
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
  emptyState: {
    flex: 1,
    padding: theme.spacing(6),
    justifyContent: "center",
  },
  emptyBody: {
    color: theme.color.textSecondary,
    fontSize: theme.font.body,
    marginTop: theme.spacing(3),
    lineHeight: 21,
  },
  cta: {
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(4),
    alignItems: "center",
    marginTop: theme.spacing(5),
  },
  ctaLabel: {
    color: theme.color.background,
    fontWeight: "800",
    fontSize: theme.font.subtitle,
  },
});
