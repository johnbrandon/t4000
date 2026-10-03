import { Pool } from "pg";

// Connects to the Postgres given by DATABASE_URL (Railway injects this). Railway
// hands out either a public proxy URL (needs TLS) or a private
// `*.railway.internal` URL (no TLS); pick SSL accordingly. PGSSL=disable|require
// forces it if ever needed.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

function useSsl(url: string): boolean {
  const forced = process.env.PGSSL;
  if (forced === "disable") return false;
  if (forced === "require") return true;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* leave host empty */
  }
  const noTls =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".railway.internal") ||
    host.endsWith(".internal");
  return !noTls;
}

export const pool = new Pool({
  connectionString,
  ssl: useSsl(connectionString) ? { rejectUnauthorized: false } : false,
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

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      icloud_uid TEXT UNIQUE,
      full_name TEXT NOT NULL DEFAULT '',
      emails JSONB NOT NULL DEFAULT '[]'::jsonb,
      phones JSONB NOT NULL DEFAULT '[]'::jsonb,
      addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
      organization TEXT,
      source TEXT NOT NULL DEFAULT 'icloud',
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_full_name ON contacts (lower(full_name));
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

// --- contacts ---
export interface Contact {
  id: string;
  icloudUid: string | null;
  fullName: string;
  emails: string[];
  phones: string[];
  addresses: string[];
  organization: string | null;
  source: string; // "icloud" | "manual"
  updatedAt: string; // ISO 8601
}

// What an importer hands us: everything but the local id + timestamp.
export type ContactImport = Omit<Contact, "id" | "updatedAt">;

interface ContactRow {
  id: string;
  icloud_uid: string | null;
  full_name: string;
  emails: unknown;
  phones: unknown;
  addresses: unknown;
  organization: string | null;
  source: string;
  updated_at: string;
}

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    icloudUid: row.icloud_uid,
    fullName: row.full_name,
    emails: asStringArray(row.emails),
    phones: asStringArray(row.phones),
    addresses: asStringArray(row.addresses),
    organization: row.organization,
    source: row.source,
    updatedAt: row.updated_at,
  };
}

export async function listContacts(): Promise<Contact[]> {
  const { rows } = await pool.query<ContactRow>(
    "SELECT * FROM contacts ORDER BY lower(full_name) ASC, id ASC"
  );
  return rows.map(rowToContact);
}

export async function getContact(id: string): Promise<Contact | null> {
  const { rows } = await pool.query<ContactRow>("SELECT * FROM contacts WHERE id = $1", [id]);
  return rows[0] ? rowToContact(rows[0]) : null;
}

// Upsert an iCloud contact keyed on its stable iCloud UID: new UIDs insert, known
// ones update in place (keeping the local id), so repeat syncs never duplicate.
export async function upsertICloudContact(input: ContactImport): Promise<void> {
  if (!input.icloudUid) return; // can't dedupe without a stable key; skip.
  await pool.query(
    `INSERT INTO contacts (id, icloud_uid, full_name, emails, phones, addresses, organization, source, updated_at)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9)
     ON CONFLICT (icloud_uid) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       emails = EXCLUDED.emails,
       phones = EXCLUDED.phones,
       addresses = EXCLUDED.addresses,
       organization = EXCLUDED.organization,
       source = EXCLUDED.source,
       updated_at = EXCLUDED.updated_at`,
    [
      makeId(),
      input.icloudUid,
      input.fullName ?? "",
      JSON.stringify(input.emails ?? []),
      JSON.stringify(input.phones ?? []),
      JSON.stringify(input.addresses ?? []),
      input.organization ?? null,
      input.source ?? "icloud",
      new Date().toISOString(),
    ]
  );
}

// Delete iCloud-sourced contacts whose UID is no longer in iCloud (handles
// contacts the user removed upstream). Never touches manually-added contacts.
export async function pruneICloudContactsNotIn(keepUids: string[]): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM contacts
     WHERE source = 'icloud'
       AND icloud_uid IS NOT NULL
       AND NOT (icloud_uid = ANY($1::text[]))`,
    [keepUids]
  );
  return rowCount ?? 0;
}
