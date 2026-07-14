import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../lib/theme";
import { formatDuration, formatRelativeTime } from "../lib/time";
import { QUALITY_NEUTRAL, type CheckIn } from "../lib/types";
import { formatTemperature } from "../lib/weather";
import ActivityIcon from "./ActivityIcon";

export default function CheckInCard({
  checkIn,
  temperatureUnit,
  onPress,
}: {
  checkIn: CheckIn;
  temperatureUnit: "C" | "F";
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.cardPressed : null]}
      onPress={onPress}
    >
      <View style={styles.row}>
        <ActivityIcon activity={checkIn.activityTypes[0]} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{checkIn.activityTypes.join(" · ")}</Text>
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
        <Stat icon="clock-outline" label={formatDuration(checkIn.durationMinutes)} />
        <QualityStat value={checkIn.quality} />
        <Stat icon="thermometer" label={formatTemperature(checkIn.temperatureC, temperatureUnit)} />
        <Stat icon="water-outline" label={`${formatTemperature(checkIn.dewpointC, temperatureUnit)} dp`} />
        {checkIn.weatherCondition ? <Stat icon="weather-partly-cloudy" label={checkIn.weatherCondition} /> : null}
      </View>

      {checkIn.participants.length > 0 ? (
        <View style={styles.participantsRow}>
          <MaterialCommunityIcons name="account-group-outline" size={14} color={theme.color.textMuted} />
          <Text style={styles.participants}>{checkIn.participants.join(", ")}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Stat({ icon, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={14} color={theme.color.textMuted} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QualityStat({ value }: { value: number }) {
  const color =
    value > QUALITY_NEUTRAL ? theme.color.accent : value < QUALITY_NEUTRAL ? theme.color.danger : theme.color.textMuted;
  const icon =
    value > QUALITY_NEUTRAL
      ? "emoticon-happy-outline"
      : value < QUALITY_NEUTRAL
      ? "emoticon-sad-outline"
      : "emoticon-neutral-outline";
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={[styles.statLabel, { color }]}>{`${value}/5`}</Text>
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
  cardPressed: {
    borderColor: theme.color.accent,
    opacity: 0.85,
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
    fontFamily: theme.font.display,
    fontSize: theme.font.subtitle,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
