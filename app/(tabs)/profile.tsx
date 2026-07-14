import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ActivityIcon from "../../components/ActivityIcon";
import Chip from "../../components/Chip";
import StatCard from "../../components/StatCard";
import { useCheckIns, useSettings } from "../../lib/hooks";
import { activityColor, theme } from "../../lib/theme";
import { formatDuration } from "../../lib/time";
import type { ActivityType } from "../../lib/types";

const PERSON_COLORS = ["#4C8DFF", "#3DDC97", "#C792EA", "#F5B942", "#FF8DC7", "#4CD3E0"];

export default function ProfileScreen() {
  const { settings, update } = useSettings();
  const { checkIns } = useCheckIns();

  const totals = useMemo(() => {
    const minutesByActivity = new Map<ActivityType, number>();
    let totalMinutes = 0;
    for (const c of checkIns) {
      totalMinutes += c.durationMinutes;
      for (const activity of c.activityTypes) {
        minutesByActivity.set(activity, (minutesByActivity.get(activity) ?? 0) + c.durationMinutes);
      }
    }
    const top = [...minutesByActivity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { totalMinutes, top };
  }, [checkIns]);

  // People tagged in check-ins, by total time spent with them (desc).
  const people = useMemo(() => {
    const minutesByPerson = new Map<string, number>();
    for (const c of checkIns) {
      for (const p of c.participants) {
        const name = p.trim();
        if (!name) continue;
        minutesByPerson.set(name, (minutesByPerson.get(name) ?? 0) + c.durationMinutes);
      }
    }
    return [...minutesByPerson.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [checkIns]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.statsRow}>
          <StatCard label="Check-ins" value={String(checkIns.length)} accent={theme.color.accent} />
          <StatCard label="Total time" value={formatDuration(totals.totalMinutes)} accent={theme.color.accentBlue} />
        </View>

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

        {people.length > 0 ? (
          <Section title="Who you spend your time with">
            {people.map(([name, minutes], i) => {
              const color = PERSON_COLORS[i % PERSON_COLORS.length];
              return (
                <View key={name} style={styles.breakdownRow}>
                  <View style={[styles.personBadge, { backgroundColor: color + "26", borderColor: color }]}>
                    <MaterialCommunityIcons name="account" size={12} color={color} />
                  </View>
                  <Text style={styles.breakdownLabel} numberOfLines={1}>
                    {abbreviateName(name)}
                  </Text>
                  <View style={styles.breakdownBarTrack}>
                    <View
                      style={[
                        styles.breakdownBarFill,
                        { width: `${Math.max(4, (minutes / (people[0][1] || 1)) * 100)}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                  <Text style={styles.breakdownValue}>{formatDuration(minutes)}</Text>
                </View>
              );
            })}
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// Abbreviate a full name to first initial + last name ("Bill Couch" -> "B Couch").
// Single-word names are left unchanged.
function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  return `${parts[0][0].toUpperCase()} ${last}`;
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
    fontWeight: "600",
    letterSpacing: -0.2,
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
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
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
  personBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
