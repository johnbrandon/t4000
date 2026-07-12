import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../lib/theme";
import { formatDuration, formatRelativeTime } from "../lib/time";
import type { CheckIn } from "../lib/types";
import { formatTemperature } from "../lib/weather";
import ActivityIcon from "./ActivityIcon";

export default function CheckInCard({ checkIn, temperatureUnit }: { checkIn: CheckIn; temperatureUnit: "C" | "F" }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <ActivityIcon activity={checkIn.activityType} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{checkIn.activityType}</Text>
          <Text style={styles.subtitle}>
            {checkIn.placeLabel ??
              (checkIn.latitude !== null && checkIn.longitude !== null
                ? `${checkIn.latitude.toFixed(3)}, ${checkIn.longitude.toFixed(3)}`
                : "No location")}
          </Text>
        </View>
        <Text style={styles.timestamp}>{formatRelativeTime(checkIn.createdAt)}</Text>
      </View>

      {checkIn.purpose ? <Text style={styles.purpose}>{checkIn.purpose}</Text> : null}

      <View style={styles.statsRow}>
        <Stat icon="time-outline" label={formatDuration(checkIn.durationMinutes)} />
        <Stat icon="thermometer-outline" label={formatTemperature(checkIn.temperatureC, temperatureUnit)} />
        <Stat icon="water-outline" label={`${formatTemperature(checkIn.dewpointC, temperatureUnit)} dp`} />
        {checkIn.weatherCondition ? <Stat icon="partly-sunny-outline" label={checkIn.weatherCondition} /> : null}
      </View>

      {checkIn.participants.length > 0 ? (
        <View style={styles.participantsRow}>
          <Ionicons name="people-outline" size={14} color={theme.color.textMuted} />
          <Text style={styles.participants}>{checkIn.participants.join(", ")}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={theme.color.textMuted} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.spacing(4),
    marginBottom: theme.spacing(3),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    marginLeft: theme.spacing(3),
    flex: 1,
  },
  title: {
    color: theme.color.textPrimary,
    fontSize: theme.font.subtitle,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.color.textSecondary,
    fontSize: theme.font.caption,
    marginTop: 2,
  },
  timestamp: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
  },
  purpose: {
    color: theme.color.textSecondary,
    fontSize: theme.font.body,
    marginTop: theme.spacing(3),
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: theme.spacing(3),
    gap: theme.spacing(4),
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing(3),
    gap: 6,
  },
  participants: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
  },
});
