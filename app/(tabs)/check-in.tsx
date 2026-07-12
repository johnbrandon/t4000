import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { deleteCheckIn, getCheckIn, insertCheckIn, updateCheckIn } from "../../lib/db";
import { getCurrentCoordinates, reverseGeocode, type Coordinates } from "../../lib/location";
import { activityColor, theme } from "../../lib/theme";
import { ACTIVITY_TYPES, QUALITY_LEVELS, QUALITY_NEUTRAL, type ActivityType } from "../../lib/types";
import { fetchWeather, fetchWeatherAt, formatTemperature, type WeatherSnapshot } from "../../lib/weather";

type Mode = "now" | "past";

function pad(n: number): string {
  return `${n}`.padStart(2, "0");
}

function nowDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTimeString(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Parse local "YYYY-MM-DD" + "HH:MM" into a Date, or null if malformed.
function parsePastDateTime(dateStr: string, timeStr: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!dm || !tm) return null;
  const [, y, mo, d] = dm.map(Number);
  const [, h, mi] = tm.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

type LocationState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; coords: Coordinates; placeLabel: string | null; weather: WeatherSnapshot | null };

export default function CheckInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === "string" ? params.id : null;
  const editing = editId !== null;

  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [quality, setQuality] = useState(QUALITY_NEUTRAL);

  function toggleActivity(activity: ActivityType) {
    setActivityTypes((prev) =>
      prev.includes(activity) ? prev.filter((a) => a !== activity) : [...prev, activity]
    );
  }
  const [purpose, setPurpose] = useState("");
  const [participantInput, setParticipantInput] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("now");
  const initial = useRef(new Date());
  const [pastDate, setPastDate] = useState(nowDateString(initial.current));
  const [pastTime, setPastTime] = useState(nowTimeString(initial.current));
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const existingWeather = useRef<WeatherSnapshot | null>(null);

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

  // In "now" mode we auto-acquire the device location. When editing, we load
  // the check-in into the (past-style) form instead.
  useEffect(() => {
    if (editing) return;
    loadLocation();
  }, [editing]);

  useEffect(() => {
    if (!editId) return;
    getCheckIn(editId).then((c) => {
      if (!c) return;
      setActivityTypes(c.activityTypes);
      setQuality(c.quality);
      setPurpose(c.purpose);
      setParticipants(c.participants);
      setDurationMinutes(String(c.durationMinutes));
      const when = new Date(c.createdAt);
      setPastDate(nowDateString(when));
      setPastTime(nowTimeString(when));
      setLatInput(c.latitude != null ? String(c.latitude) : "");
      setLonInput(c.longitude != null ? String(c.longitude) : "");
      setResolvedAddress(c.placeLabel);
      existingWeather.current = c.weatherCode != null && c.temperatureC != null
        ? {
            temperatureC: c.temperatureC,
            dewpointC: c.dewpointC ?? c.temperatureC,
            weatherCode: c.weatherCode,
            weatherCondition: c.weatherCondition ?? "",
          }
        : null;
      setMode("past");
    });
  }, [editId]);

  // Look up the street address whenever valid coordinates are entered in
  // past/edit mode, so the check-in shows where it happened.
  useEffect(() => {
    if (mode !== "past") return;
    const lat = Number(latInput);
    const lon = Number(lonInput);
    if (
      latInput.trim() === "" ||
      lonInput.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      return;
    }
    let cancelled = false;
    setAddressLoading(true);
    const handle = setTimeout(() => {
      reverseGeocode({ latitude: lat, longitude: lon })
        .then((addr) => {
          if (!cancelled) setResolvedAddress(addr);
        })
        .finally(() => {
          if (!cancelled) setAddressLoading(false);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [latInput, lonInput, mode]);

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

  async function fillCurrentCoords() {
    try {
      const coords = await getCurrentCoordinates();
      setLatInput(coords.latitude.toFixed(5));
      setLonInput(coords.longitude.toFixed(5));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't get your location.");
    }
  }

  function resetForm() {
    setPurpose("");
    setParticipants([]);
    setDurationMinutes("");
    setElapsedSeconds(0);
    setLatInput("");
    setLonInput("");
  }

  async function handleDelete() {
    if (!editId) return;
    // Two-tap confirm (Alert has no web implementation).
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setSubmitting(true);
    try {
      await deleteCheckIn(editId);
      router.push("/");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't delete the check-in.");
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    // Duration is optional; treat a blank/invalid value as 0 minutes.
    const parsed = Number(durationMinutes);
    const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    if (activityTypes.length === 0) {
      // Alert has no implementation on react-native-web, so surface validation
      // inline instead — otherwise the tap looks like it does nothing.
      setFormError("Pick at least one interaction.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === "past") {
        await savePastCheckIn(minutes);
      } else {
        await saveNowCheckIn(minutes);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save the check-in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveNowCheckIn(minutes: number) {
    // Location is best-effort: if it isn't ready (permission denied, still
    // resolving, or unavailable) the check-in still saves without coordinates.
    const ready = location.status === "ready" ? location : null;
    await insertCheckIn({
      latitude: ready?.coords.latitude ?? null,
      longitude: ready?.coords.longitude ?? null,
      placeLabel: ready?.placeLabel ?? null,
      temperatureC: ready?.weather?.temperatureC ?? null,
      dewpointC: ready?.weather?.dewpointC ?? null,
      weatherCondition: ready?.weather?.weatherCondition ?? null,
      weatherCode: ready?.weather?.weatherCode ?? null,
      durationMinutes: minutes,
      activityTypes,
      quality,
      purpose: purpose.trim(),
      participants,
    });
    resetForm();
    router.push("/");
  }

  async function savePastCheckIn(minutes: number) {
    const when = parsePastDateTime(pastDate, pastTime);
    if (!when) {
      setFormError("Enter a valid date (YYYY-MM-DD) and time (HH:MM).");
      return;
    }
    if (when.getTime() > Date.now()) {
      setFormError("That date & time is in the future.");
      return;
    }

    const lat = Number(latInput);
    const lon = Number(lonInput);
    const anyCoord = latInput.trim() !== "" || lonInput.trim() !== "";
    const validCoords =
      Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    if (anyCoord && !validCoords) {
      setFormError("Enter valid coordinates (latitude −90..90, longitude −180..180), or leave both blank.");
      return;
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    let placeLabel: string | null = null;
    let weather: WeatherSnapshot | null = null;

    if (anyCoord && validCoords) {
      latitude = lat;
      longitude = lon;
      // Resolve the address (reuse the already-resolved one when present) and
      // look up the historical weather for that date/time & place.
      const [addr, fetched] = await Promise.all([
        resolvedAddress ? Promise.resolve(resolvedAddress) : reverseGeocode({ latitude, longitude }),
        fetchWeatherAt(latitude, longitude, when).catch(() => null),
      ]);
      placeLabel = addr ?? resolvedAddress ?? null;
      // Keep the existing weather (when editing) if the lookup came back empty.
      weather = fetched ?? (editing ? existingWeather.current : null);
    }

    const fields = {
      latitude,
      longitude,
      placeLabel,
      temperatureC: weather?.temperatureC ?? null,
      dewpointC: weather?.dewpointC ?? null,
      weatherCondition: weather?.weatherCondition ?? null,
      weatherCode: weather?.weatherCode ?? null,
      durationMinutes: minutes,
      activityTypes,
      quality,
      purpose: purpose.trim(),
      participants,
    };

    if (editing && editId) {
      await updateCheckIn(editId, fields, when.toISOString());
    } else {
      await insertCheckIn(fields, when.toISOString());
    }
    resetForm();
    router.push("/");
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{editing ? "Edit check-in" : "New check-in"}</Text>

          {!editing ? (
            <View style={styles.modeRow}>
              <ModeButton label="Now" active={mode === "now"} onPress={() => setMode("now")} />
              <ModeButton label="In the past" active={mode === "past"} onPress={() => setMode("past")} />
            </View>
          ) : null}

          {mode === "now" ? (
            <Section title="Location & conditions">
              <LocationCard state={location} onRetry={loadLocation} />
            </Section>
          ) : (
            <>
              <Section title="Date & time">
                <View style={styles.durationRow}>
                  <TextInput
                    style={[styles.input, styles.durationInput]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.color.textMuted}
                    value={pastDate}
                    onChangeText={setPastDate}
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={[styles.input, { width: 96 }]}
                    placeholder="HH:MM"
                    placeholderTextColor={theme.color.textMuted}
                    value={pastTime}
                    onChangeText={setPastTime}
                    autoCapitalize="none"
                  />
                </View>
              </Section>

              <Section title="Coordinates">
                <View style={styles.durationRow}>
                  <TextInput
                    style={[styles.input, styles.durationInput]}
                    placeholder="Latitude"
                    placeholderTextColor={theme.color.textMuted}
                    keyboardType="numbers-and-punctuation"
                    value={latInput}
                    onChangeText={setLatInput}
                  />
                  <TextInput
                    style={[styles.input, styles.durationInput]}
                    placeholder="Longitude"
                    placeholderTextColor={theme.color.textMuted}
                    keyboardType="numbers-and-punctuation"
                    value={lonInput}
                    onChangeText={setLonInput}
                  />
                </View>
                <Pressable onPress={fillCurrentCoords} style={styles.retryButton}>
                  <Text style={styles.retryLabel}>Use my current location</Text>
                </Pressable>
                {addressLoading ? (
                  <View style={styles.addressRow}>
                    <ActivityIndicator size="small" color={theme.color.textMuted} />
                    <Text style={styles.locationHint}>Looking up address…</Text>
                  </View>
                ) : resolvedAddress ? (
                  <View style={styles.addressRow}>
                    <MaterialCommunityIcons name="map-marker" size={14} color={theme.color.accent} />
                    <Text style={styles.addressText}>{resolvedAddress}</Text>
                  </View>
                ) : null}
                <Text style={styles.locationHint}>
                  Temperature, weather & dewpoint are looked up for this date & place when you save.
                </Text>
              </Section>
            </>
          )}

          <Section title="Interactions (choose one or more)">
            <View style={styles.chipWrap}>
              {ACTIVITY_TYPES.map((activity) => (
                <Chip
                  key={activity}
                  label={activity}
                  color={activityColor(activity)}
                  selected={activityTypes.includes(activity)}
                  onPress={() => toggleActivity(activity)}
                />
              ))}
            </View>
          </Section>

          <Section title="Interaction quality">
            <View style={styles.qualityRow}>
              {QUALITY_LEVELS.map((level) => {
                const active = quality === level.value;
                const color =
                  level.value > QUALITY_NEUTRAL
                    ? theme.color.accent
                    : level.value < QUALITY_NEUTRAL
                    ? theme.color.danger
                    : theme.color.textMuted;
                return (
                  <Pressable
                    key={level.value}
                    style={[
                      styles.qualityButton,
                      active && { backgroundColor: color + "26", borderColor: color },
                    ]}
                    onPress={() => setQuality(level.value)}
                  >
                    <Text style={[styles.qualityValue, active && { color }]}>{level.value}</Text>
                    <Text style={[styles.qualityLabel, active && { color }]}>{level.label}</Text>
                  </Pressable>
                );
              })}
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
                <MaterialCommunityIcons name={timerRunning ? "stop" : "play"} size={18} color={theme.color.background} />
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
                <MaterialCommunityIcons name="plus" size={20} color={theme.color.background} />
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

          {formError ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={theme.color.danger} />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.color.background} />
            ) : (
              <Text style={styles.submitLabel}>{editing ? "Save changes" : "Save check-in"}</Text>
            )}
          </Pressable>

          {editing ? (
            <Pressable
              style={[styles.deleteButton, confirmDelete && styles.deleteButtonConfirm]}
              onPress={handleDelete}
              disabled={submitting}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.color.danger} />
              <Text style={styles.deleteLabel}>{confirmDelete ? "Tap again to delete" : "Delete check-in"}</Text>
            </Pressable>
          ) : null}
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

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.modeButton, active && styles.modeButtonActive]} onPress={onPress}>
      <Text style={[styles.modeButtonLabel, active && styles.modeButtonLabelActive]}>{label}</Text>
    </Pressable>
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
        <Text style={styles.locationHint}>You can still save this check-in without a location.</Text>
        <Pressable onPress={onRetry} style={styles.locationButton}>
          <MaterialCommunityIcons name="map-marker" size={16} color={theme.color.background} />
          <Text style={styles.locationButtonLabel}>Use my location</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.locationCard}>
      <View style={styles.locationRow}>
        <MaterialCommunityIcons name="map-marker" size={16} color={theme.color.accent} />
        <Text style={styles.locationText}>
          {state.placeLabel ?? `${state.coords.latitude.toFixed(3)}, ${state.coords.longitude.toFixed(3)}`}
        </Text>
      </View>
      {state.weather ? (
        <View style={styles.locationRow}>
          <MaterialCommunityIcons name="weather-partly-cloudy" size={16} color={theme.color.accentBlue} />
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
  modeRow: {
    flexDirection: "row",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(5),
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: theme.spacing(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  modeButtonActive: {
    backgroundColor: theme.color.accent + "26",
    borderColor: theme.color.accent,
  },
  modeButtonLabel: {
    color: theme.color.textSecondary,
    fontSize: theme.font.body,
    fontWeight: "700",
  },
  modeButtonLabelActive: {
    color: theme.color.accent,
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
  qualityRow: {
    flexDirection: "row",
    gap: theme.spacing(2),
  },
  qualityButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  qualityValue: {
    color: theme.color.textSecondary,
    fontSize: theme.font.subtitle,
    fontWeight: "800",
  },
  qualityLabel: {
    color: theme.color.textMuted,
    fontSize: 10,
    marginTop: 2,
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
  locationHint: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    fontStyle: "italic",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: theme.spacing(1),
  },
  addressText: {
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
    flexShrink: 1,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: theme.color.accent,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radius.sm,
    marginTop: theme.spacing(1),
  },
  locationButtonLabel: {
    color: theme.color.background,
    fontSize: theme.font.caption,
    fontWeight: "700",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.color.danger + "1A",
    borderWidth: 1,
    borderColor: theme.color.danger + "55",
    borderRadius: theme.radius.sm,
    padding: theme.spacing(3),
    marginTop: theme.spacing(2),
  },
  errorText: {
    color: theme.color.danger,
    fontSize: theme.font.caption,
    flexShrink: 1,
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
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: theme.spacing(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.danger + "55",
    marginTop: theme.spacing(3),
  },
  deleteButtonConfirm: {
    backgroundColor: theme.color.danger + "1A",
    borderColor: theme.color.danger,
  },
  deleteLabel: {
    color: theme.color.danger,
    fontSize: theme.font.body,
    fontWeight: "700",
  },
});
