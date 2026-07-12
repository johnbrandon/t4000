import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Chip from "../../components/Chip";
import { insertCheckIn } from "../../lib/db";
import { getCurrentCoordinates, reverseGeocode, type Coordinates } from "../../lib/location";
import { activityColor, theme } from "../../lib/theme";
import { ACTIVITY_TYPES, type ActivityType } from "../../lib/types";
import { fetchWeather, formatTemperature, type WeatherSnapshot } from "../../lib/weather";

type LocationState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; coords: Coordinates; placeLabel: string | null; weather: WeatherSnapshot | null };

export default function CheckInScreen() {
  const router = useRouter();

  const [activityType, setActivityType] = useState<ActivityType>("Run");
  const [purpose, setPurpose] = useState("");
  const [participantInput, setParticipantInput] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const [location, setLocation] = useState<LocationState>({ status: "loading" });

  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLocation = async () => {
    setLocation({ status: "loading" });
    try {
      const coords = await getCurrentCoordinates();
      const [placeLabel, weather] = await Promise.all([
        reverseGeocode(coords),
        fetchWeather(coords.latitude, coords.longitude).catch(() => null),
      ]);
      setLocation({ status: "ready", coords, placeLabel, weather });
    } catch (err) {
      setLocation({
        status: "error",
        message: err instanceof Error ? err.message : "Couldn't get your location.",
      });
    }
  };

  useEffect(() => {
    loadLocation();
  }, []);

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning]);

  function toggleTimer() {
    if (timerRunning) {
      setTimerRunning(false);
      setDurationMinutes(String(Math.max(1, Math.round(elapsedSeconds / 60))));
    } else {
      setElapsedSeconds(0);
      setTimerRunning(true);
    }
  }

  function addParticipant() {
    const name = participantInput.trim();
    if (!name) return;
    setParticipants((prev) => [...prev, name]);
    setParticipantInput("");
  }

  function removeParticipant(name: string) {
    setParticipants((prev) => prev.filter((p) => p !== name));
  }

  async function handleSubmit() {
    const minutes = Number(durationMinutes);
    if (!minutes || minutes <= 0) {
      Alert.alert("Add a duration", "How long was this activity, in minutes?");
      return;
    }
    if (location.status !== "ready") {
      Alert.alert("Location not ready", "We need your location to save a check-in.");
      return;
    }

    setSubmitting(true);
    try {
      await insertCheckIn({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        placeLabel: location.placeLabel,
        temperatureC: location.weather?.temperatureC ?? null,
        dewpointC: location.weather?.dewpointC ?? null,
        weatherCondition: location.weather?.weatherCondition ?? null,
        weatherCode: location.weather?.weatherCode ?? null,
        durationMinutes: minutes,
        activityType,
        purpose: purpose.trim(),
        participants,
      });

      setPurpose("");
      setParticipants([]);
      setDurationMinutes("0");
      setElapsedSeconds(0);
      router.push("/");
    } catch (err) {
      Alert.alert("Couldn't save check-in", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>New check-in</Text>

          <Section title="Location & conditions">
            <LocationCard state={location} onRetry={loadLocation} />
          </Section>

          <Section title="Activity">
            <View style={styles.chipWrap}>
              {ACTIVITY_TYPES.map((activity) => (
                <Chip
                  key={activity}
                  label={activity}
                  color={activityColor(activity)}
                  selected={activityType === activity}
                  onPress={() => setActivityType(activity)}
                />
              ))}
            </View>
          </Section>

          <Section title="Purpose">
            <TextInput
              style={styles.input}
              placeholder="What was this for?"
              placeholderTextColor={theme.color.textMuted}
              value={purpose}
              onChangeText={setPurpose}
              multiline
            />
          </Section>

          <Section title="Length of activity">
            <View style={styles.durationRow}>
              <TextInput
                style={[styles.input, styles.durationInput]}
                placeholder="Minutes"
                placeholderTextColor={theme.color.textMuted}
                keyboardType="number-pad"
                value={durationMinutes}
                editable={!timerRunning}
                onChangeText={setDurationMinutes}
              />
              <Pressable
                style={[styles.timerButton, timerRunning && styles.timerButtonActive]}
                onPress={toggleTimer}
              >
                <Ionicons name={timerRunning ? "stop" : "play"} size={18} color={theme.color.background} />
                <Text style={styles.timerButtonLabel}>
                  {timerRunning ? formatClock(elapsedSeconds) : "Start timer"}
                </Text>
              </Pressable>
            </View>
          </Section>

          <Section title="Others participating">
            <View style={styles.durationRow}>
              <TextInput
                style={[styles.input, styles.durationInput]}
                placeholder="Add a name"
                placeholderTextColor={theme.color.textMuted}
                value={participantInput}
                onChangeText={setParticipantInput}
                onSubmitEditing={addParticipant}
                returnKeyType="done"
              />
              <Pressable style={styles.addButton} onPress={addParticipant}>
                <Ionicons name="add" size={20} color={theme.color.background} />
              </Pressable>
            </View>
            {participants.length > 0 ? (
              <View style={styles.chipWrap}>
                {participants.map((name) => (
                  <Chip key={name} label={`${name}  ✕`} selected onPress={() => removeParticipant(name)} />
                ))}
              </View>
            ) : null}
          </Section>

          <Pressable
            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.color.background} />
            ) : (
              <Text style={styles.submitLabel}>Save check-in</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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

function LocationCard({ state, onRetry }: { state: LocationState; onRetry: () => void }) {
  if (state.status === "loading") {
    return (
      <View style={styles.locationCard}>
        <ActivityIndicator color={theme.color.accent} />
        <Text style={styles.locationMuted}>Finding you and checking the weather…</Text>
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View style={styles.locationCard}>
        <Text style={styles.locationMuted}>{state.message}</Text>
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.locationCard}>
      <View style={styles.locationRow}>
        <Ionicons name="location" size={16} color={theme.color.accent} />
        <Text style={styles.locationText}>
          {state.placeLabel ?? `${state.coords.latitude.toFixed(3)}, ${state.coords.longitude.toFixed(3)}`}
        </Text>
      </View>
      {state.weather ? (
        <View style={styles.locationRow}>
          <Ionicons name="partly-sunny" size={16} color={theme.color.accentBlue} />
          <Text style={styles.locationText}>
            {formatTemperature(state.weather.temperatureC, "F")} · {state.weather.weatherCondition} · dewpoint{" "}
            {formatTemperature(state.weather.dewpointC, "F")}
          </Text>
        </View>
      ) : (
        <Text style={styles.locationMuted}>Weather unavailable right now.</Text>
      )}
      <Pressable onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryLabel}>Refresh</Text>
      </Pressable>
    </View>
  );
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
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
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  durationRow: {
    flexDirection: "row",
    gap: theme.spacing(3),
    alignItems: "center",
  },
  durationInput: {
    flex: 1,
  },
  timerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.color.accent,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    borderRadius: theme.radius.sm,
  },
  timerButtonActive: {
    backgroundColor: theme.color.accentAlt,
  },
  timerButtonLabel: {
    color: theme.color.background,
    fontWeight: "700",
    fontSize: theme.font.caption,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  locationCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationText: {
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
    flexShrink: 1,
  },
  locationMuted: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: theme.spacing(1),
  },
  retryLabel: {
    color: theme.color.accent,
    fontSize: theme.font.caption,
    fontWeight: "700",
  },
  submitButton: {
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(4),
    alignItems: "center",
    marginTop: theme.spacing(3),
  },
  submitLabel: {
    color: theme.color.background,
    fontSize: theme.font.subtitle,
    fontWeight: "800",
  },
});
