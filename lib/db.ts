import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import type { CheckIn, NewCheckIn, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const DB_NAME = "checkin.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      if (Platform.OS !== "web") {
        await db.execAsync("PRAGMA journal_mode = WAL;");
      }
      // latitude/longitude are nullable so a check-in can still be saved when
      // the device location is unavailable or the user declines the prompt.
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS check_ins (
          id TEXT PRIMARY KEY NOT NULL,
          created_at TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          place_label TEXT,
          temperature_c REAL,
          dewpoint_c REAL,
          weather_condition TEXT,
          weather_code INTEGER,
          duration_minutes INTEGER NOT NULL,
          activity_type TEXT NOT NULL,
          activity_types TEXT,
          quality INTEGER NOT NULL DEFAULT 0,
          purpose TEXT NOT NULL,
          participants TEXT NOT NULL DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON check_ins (created_at);

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

// Schema migrations, driven by the actual columns present so they run once and
// are safe on any prior version:
//   1. Early builds had NOT NULL latitude/longitude — rebuild to nullable.
//   2. Add activity_types (JSON) for multi-activity check-ins; backfill from
//      the single activity_type.
async function migrate(db: SQLite.SQLiteDatabase) {
  let info = await db.getAllAsync<{ name: string; notnull: number }>("PRAGMA table_info(check_ins)");
  const latCol = info.find((c) => c.name === "latitude");

  if (latCol && latCol.notnull === 1) {
    await db.execAsync(`
      BEGIN TRANSACTION;
      CREATE TABLE check_ins_new (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        place_label TEXT,
        temperature_c REAL,
        dewpoint_c REAL,
        weather_condition TEXT,
        weather_code INTEGER,
        duration_minutes INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        activity_types TEXT,
        purpose TEXT NOT NULL,
        participants TEXT NOT NULL DEFAULT '[]'
      );
      INSERT INTO check_ins_new
        (id, created_at, latitude, longitude, place_label, temperature_c, dewpoint_c,
         weather_condition, weather_code, duration_minutes, activity_type, activity_types, purpose, participants)
      SELECT id, created_at, latitude, longitude, place_label, temperature_c, dewpoint_c,
         weather_condition, weather_code, duration_minutes, activity_type, NULL, purpose, participants
      FROM check_ins;
      DROP TABLE check_ins;
      ALTER TABLE check_ins_new RENAME TO check_ins;
      CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON check_ins (created_at);
      COMMIT;
    `);
    info = await db.getAllAsync<{ name: string; notnull: number }>("PRAGMA table_info(check_ins)");
  }

  if (!info.some((c) => c.name === "activity_types")) {
    await db.execAsync("ALTER TABLE check_ins ADD COLUMN activity_types TEXT");
  }
  if (!info.some((c) => c.name === "quality")) {
    await db.execAsync("ALTER TABLE check_ins ADD COLUMN quality INTEGER NOT NULL DEFAULT 0");
  }
  // Backfill activity_types from the legacy single activity_type.
  const rows = await db.getAllAsync<{ id: string; activity_type: string }>(
    "SELECT id, activity_type FROM check_ins WHERE activity_types IS NULL"
  );
  for (const r of rows) {
    await db.runAsync("UPDATE check_ins SET activity_types = ? WHERE id = ?", [
      JSON.stringify([r.activity_type]),
      r.id,
    ]);
  }
}

// --- change notifications so screens can refresh after a write ---
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeCheckIns(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChanged() {
  for (const listener of listeners) listener();
}

// --- row <-> model mapping ---
interface CheckInRow {
  id: string;
  created_at: string;
  latitude: number;
  longitude: number;
  place_label: string | null;
  temperature_c: number | null;
  dewpoint_c: number | null;
  weather_condition: string | null;
  weather_code: number | null;
  duration_minutes: number;
  activity_type: string;
  activity_types: string | null;
  quality: number | null;
  purpose: string;
  participants: string;
}

function parseActivityTypes(row: CheckInRow): CheckIn["activityTypes"] {
  if (row.activity_types) {
    try {
      const parsed = JSON.parse(row.activity_types);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as CheckIn["activityTypes"];
    } catch {
      // fall through to the legacy single value
    }
  }
  return [row.activity_type] as CheckIn["activityTypes"];
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
    activityTypes: parseActivityTypes(row),
    quality: typeof row.quality === "number" ? row.quality : 0,
    purpose: row.purpose,
    participants: JSON.parse(row.participants || "[]"),
  };
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function insertCheckIn(input: NewCheckIn, createdAt?: string): Promise<CheckIn> {
  const db = await getDb();
  const checkIn: CheckIn = {
    ...input,
    id: makeId(),
    createdAt: createdAt ?? new Date().toISOString(),
  };
  const activities = checkIn.activityTypes.length ? checkIn.activityTypes : (["Other"] as CheckIn["activityTypes"]);
  await db.runAsync(
    `INSERT INTO check_ins
      (id, created_at, latitude, longitude, place_label, temperature_c, dewpoint_c, weather_condition, weather_code, duration_minutes, activity_type, activity_types, quality, purpose, participants)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      checkIn.id,
      checkIn.createdAt,
      checkIn.latitude,
      checkIn.longitude,
      checkIn.placeLabel,
      checkIn.temperatureC,
      checkIn.dewpointC,
      checkIn.weatherCondition,
      checkIn.weatherCode,
      checkIn.durationMinutes,
      activities[0],
      JSON.stringify(activities),
      checkIn.quality,
      checkIn.purpose,
      JSON.stringify(checkIn.participants ?? []),
    ]
  );
  notifyChanged();
  return checkIn;
}

export async function updateCheckIn(id: string, input: NewCheckIn, createdAt: string): Promise<void> {
  const db = await getDb();
  const activities = input.activityTypes.length ? input.activityTypes : (["Other"] as CheckIn["activityTypes"]);
  await db.runAsync(
    `UPDATE check_ins SET
       created_at = ?, latitude = ?, longitude = ?, place_label = ?, temperature_c = ?, dewpoint_c = ?,
       weather_condition = ?, weather_code = ?, duration_minutes = ?, activity_type = ?, activity_types = ?, quality = ?, purpose = ?, participants = ?
     WHERE id = ?`,
    [
      createdAt,
      input.latitude,
      input.longitude,
      input.placeLabel,
      input.temperatureC,
      input.dewpointC,
      input.weatherCondition,
      input.weatherCode,
      input.durationMinutes,
      activities[0],
      JSON.stringify(activities),
      input.quality,
      input.purpose,
      JSON.stringify(input.participants ?? []),
      id,
    ]
  );
  notifyChanged();
}

export async function deleteCheckIn(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM check_ins WHERE id = ?`, [id]);
  notifyChanged();
}

export async function listCheckIns(): Promise<CheckIn[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CheckInRow>(`SELECT * FROM check_ins ORDER BY created_at DESC`);
  return rows.map(rowToCheckIn);
}

export async function getCheckIn(id: string): Promise<CheckIn | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CheckInRow>(`SELECT * FROM check_ins WHERE id = ?`, [id]);
  return row ? rowToCheckIn(row) : null;
}

// --- settings ---
export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(`SELECT key, value FROM settings`);
  const stored: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    temperatureUnit: (stored.temperatureUnit as Settings["temperatureUnit"]) ?? DEFAULT_SETTINGS.temperatureUnit,
  };
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  );
  notifyChanged();
}
