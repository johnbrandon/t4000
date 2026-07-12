import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ActivityIcon from "../../components/ActivityIcon";
import Chip from "../../components/Chip";
import StatCard from "../../components/StatCard";
import { useCheckIns, useSettings } from "../../lib/hooks";
import { activityColor, theme } from "../../lib/theme";
import { ageYears, formatDuration } from "../../lib/time";
import type { ActivityType } from "../../lib/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function ProfileScreen() {
  const { settings, update } = useSettings();
  const { checkIns } = useCheckIns();
  const [birthDateDraft, setBirthDateDraft] = useState(settings.birthDate ?? "");
  const [saved, setSaved] = useState(false);

  const totals = useMemo(() => {
    const minutesByActivity = new Map<ActivityType, number>();
    let totalMinutes = 0;
    for (const c of checkIns) {
      totalMinutes += c.durationMinutes;
      minutesByActivity.set(c.activityType, (minutesByActivity.get(c.activityType) ?? 0) + c.durationMinutes);
    }
    const top = [...minutesByActivity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { totalMinutes, top };
  }, [checkIns]);

  const age = settings.birthDate ? ageYears(new Date(settings.birthDate)) : null;

  function saveBirthDate() {
    if (!DATE_PATTERN.test(birthDateDraft)) return;
    update("birthDate", birthDateDraft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.statsRow}>
          <StatCard label="Check-ins" value={String(checkIns.length)} accent={theme.color.accent} />
          <StatCard label="Total time" value={formatDuration(totals.totalMinutes)} accent={theme.color.accentBlue} />
          <StatCard label="Age" value={age ? `${age.toFixed(1)}y` : "—"} accent={theme.color.accentAlt} />
        </View>

        <Section title="Birth date (for the 4000 Weeks view)">
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.color.textMuted}
              value={birthDateDraft}
              onChangeText={setBirthDateDraft}
              autoCapitalize="none"
            />
            <Pressable style={styles.saveButton} onPress={saveBirthDate}>
              <Text style={styles.saveLabel}>{saved ? "Saved" : "Save"}</Text>
            </Pressable>
          </View>
        </Section>

        <Section title="Life expectancy (weeks)">
          <View style={styles.chipWrap}>
            {[3500, 4000, 4500, 5000].map((weeks) => (
              <Chip
                key={weeks}
                label={String(weeks)}
                selected={settings.lifeExpectancyWeeks === weeks}
                onPress={() => update("lifeExpectancyWeeks", weeks)}
              />
            ))}
          </View>
        </Section>

        <Section title="Temperature unit">
          <View style={styles.chipWrap}>
            <Chip label="Fahrenheit" selected={settings.temperatureUnit === "F"} onPress={() => update("temperatureUnit", "F")} />
            <Chip label="Celsius" selected={settings.temperatureUnit === "C"} onPress={() => update("temperatureUnit", "C")} />
          </View>
        </Section>

        {totals.top.length > 0 ? (
          <Section title="Where your time goes">
            {totals.top.map(([activity, minutes]) => (
              <View key={activity} style={styles.breakdownRow}>
                <ActivityIcon activity={activity} size={16} />
                <Text style={styles.breakdownLabel}>{activity}</Text>
                <View style={styles.breakdownBarTrack}>
                  <View
                    style={[
                      styles.breakdownBarFill,
                      {
                        width: `${Math.max(4, (minutes / totals.top[0][1]) * 100)}%`,
                        backgroundColor: activityColor(activity),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownValue}>{formatDuration(minutes)}</Text>
              </View>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
    marginBottom: theme.spacing(4),
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing(3),
    marginBottom: theme.spacing(5),
  },
  section: {
    marginBottom: theme.spacing(5),
  },
  sectionTitle: {
    color: theme.color.textSecondary,
    fontSize: theme.font.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: theme.spacing(2),
  },
  row: {
    flexDirection: "row",
    gap: theme.spacing(3),
  },
  input: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing(3),
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
  },
  saveButton: {
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(4),
    justifyContent: "center",
  },
  saveLabel: {
    color: theme.color.background,
    fontWeight: "800",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  breakdownLabel: {
    color: theme.color.textPrimary,
    fontSize: theme.font.caption,
    width: 70,
  },
  breakdownBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.surfaceRaised,
    overflow: "hidden",
  },
  breakdownBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  breakdownValue: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    width: 50,
    textAlign: "right",
  },
});
