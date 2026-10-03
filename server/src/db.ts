import { Pool } from "pg";

// Connects to the Postgres given by DATABASE_URL (Railway injects this). Enable
// TLS for any non-local host; Railway's public Postgres requires it.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// --- model shapes (match the app's lib/types.ts CheckIn / Settings) ---
export interface CheckIn {
  id: string;
  createdAt: string; // ISO 8601, stored verbatim so ordering matches the client
  latitude: number | null;
  longitude: number | null;
  placeLabel: string | null;
  temperatureC: number | null;
  dewpointC: number | null;
  weatherCondition: string | null;
  weatherCode: number | null;
  durationMinutes: number;
  activityTypes: string[];
  quality: number;
  purpose: string;
  participants: string[];
}

export type NewCheckIn = Omit<CheckIn, "id" | "createdAt">;

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      place_label TEXT,
      temperature_c DOUBLE PRECISION,
      dewpoint_c DOUBLE PRECISION,
      weather_condition TEXT,
      weather_code INTEGER,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      activity_types JSONB NOT NULL DEFAULT '[]'::jsonb,
      quality INTEGER NOT NULL DEFAULT 0,
      purpose TEXT NOT NULL DEFAULT '',
      participants JSONB NOT NULL DEFAULT '[]'::jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON check_ins (created_at DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

interface CheckInRow {
  id: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  place_label: string | null;
  temperature_c: number | null;
  dewpoint_c: number | null;
  weather_condition: string | null;
  weather_code: number | null;
  duration_minutes: number;
  activity_types: unknown;
  quality: number;
  purpose: string;
  participants: unknown;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      /* fall through */
    }
  }
  return [];
}

function rowToCheckIn(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    createdAt: row.created_at,
    latitude: row.latitude,
    longitude: row.longitude,
    placeLabel: row.place_label,
    temperatureC: row.temperature_c,
    dewpointC: row.dewpoint_c,
    weatherCondition: row.weather_condition,
    weatherCode: row.weather_code,
    durationMinutes: row.duration_minutes,
    activityTypes: asStringArray(row.activity_types),
    quality: typeof row.quality === "number" ? row.quality : 0,
    purpose: row.purpose,
    participants: asStringArray(row.participants),
  };
}

export async function listCheckIns(): Promise<CheckIn[]> {
  const { rows } = await pool.query<CheckInRow>("SELECT * FROM check_ins ORDER BY created_at DESC");
  return rows.map(rowToCheckIn);
}

export async function getCheckIn(id: string): Promise<CheckIn | null> {
  const { rows } = await pool.query<CheckInRow>("SELECT * FROM check_ins WHERE id = $1", [id]);
  return rows[0] ? rowToCheckIn(rows[0]) : null;
}

function normalize(input: NewCheckIn) {
  const activities = input.activityTypes?.length ? input.activityTypes : ["Other"];
  return {
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    placeLabel: input.placeLabel ?? null,
    temperatureC: input.temperatureC ?? null,
    dewpointC: input.dewpointC ?? null,
    weatherCondition: input.weatherCondition ?? null,
    weatherCode: input.weatherCode ?? null,
    durationMinutes: Number.isFinite(input.durationMinutes) ? input.durationMinutes : 0,
    activityTypes: JSON.stringify(activities),
    quality: Number.isFinite(input.quality) ? input.quality : 0,
    purpose: input.purpose ?? "",
    participants: JSON.stringify(input.participants ?? []),
  };
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function insertCheckIn(input: NewCheckIn, createdAt?: string): Promise<CheckIn> {
  const id = makeId();
  const when = createdAt ?? new Date().toISOString();
  const v = normalize(input);
  await pool.query(
    `INSERT INTO check_ins
      (id, created_at, latitude, longitude, place_label, temperature_c, dewpoint_c, weather_condition,
       weather_code, duration_minutes, activity_types, quality, purpose, participants)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb)`,
    [
      id, when, v.latitude, v.longitude, v.placeLabel, v.temperatureC, v.dewpointC, v.weatherCondition,
      v.weatherCode, v.durationMinutes, v.activityTypes, v.quality, v.purpose, v.participants,
    ]
  );
  return (await getCheckIn(id))!;
}

export async function updateCheckIn(id: string, input: NewCheckIn, createdAt: string): Promise<CheckIn | null> {
  const v = normalize(input);
  const { rowCount } = await pool.query(
    `UPDATE check_ins SET
       created_at=$2, latitude=$3, longitude=$4, place_label=$5, temperature_c=$6, dewpoint_c=$7,
       weather_condition=$8, weather_code=$9, duration_minutes=$10, activity_types=$11::jsonb,
       quality=$12, purpose=$13, participants=$14::jsonb
     WHERE id=$1`,
    [
      id, createdAt, v.latitude, v.longitude, v.placeLabel, v.temperatureC, v.dewpointC, v.weatherCondition,
      v.weatherCode, v.durationMinutes, v.activityTypes, v.quality, v.purpose, v.participants,
    ]
  );
  if (!rowCount) return null;
  return getCheckIn(id);
}

export async function deleteCheckIn(id: string): Promise<void> {
  await pool.query("DELETE FROM check_ins WHERE id = $1", [id]);
}

export async function getSettings(): Promise<Record<string, string>> {
  const { rows } = await pool.query<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}
