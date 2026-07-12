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

// Early builds created check_ins with NOT NULL latitude/longitude. Rebuild the
// table to the nullable schema so location-less check-ins can be saved. Guarded
// by user_version and cheap (no rows exist until this fix ships).
async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const version = row?.user_version ?? 0;
  if (version < 1) {
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
        purpose TEXT NOT NULL,
        participants TEXT NOT NULL DEFAULT '[]'
      );
      INSERT INTO check_ins_new SELECT * FROM check_ins;
      DROP TABLE check_ins;
      ALTER TABLE check_ins_new RENAME TO check_ins;
      CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON check_ins (created_at);
      COMMIT;
      PRAGMA user_version = 1;
    `);
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
  purpose: string;
  participants: string;
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
    activityType: row.activity_type as CheckIn["activityType"],
    purpose: row.purpose,
    participants: JSON.parse(row.participants || "[]"),
  };
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function insertCheckIn(input: NewCheckIn): Promise<CheckIn> {
  const db = await getDb();
  const checkIn: CheckIn = {
    ...input,
    id: makeId(),
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO check_ins
      (id, created_at, latitude, longitude, place_label, temperature_c, dewpoint_c, weather_condition, weather_code, duration_minutes, activity_type, purpose, participants)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      checkIn.activityType,
      checkIn.purpose,
      JSON.stringify(checkIn.participants ?? []),
    ]
  );
  notifyChanged();
  return checkIn;
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
