// Data access for check-ins and settings. Backed by the server API (Postgres);
// the web app talks to it over fetch (see lib/api.ts). The exported surface is
// unchanged from the old expo-sqlite version so screens and hooks don't care.
import { apiJson, apiSend } from "./api";
import type { CheckIn, Contact, NewCheckIn, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

// --- change notifications so screens refresh after a write ---
type Listener = () => void;
const listeners = new Set<Listener>();
const contactListeners = new Set<Listener>();

export function subscribeCheckIns(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyChanged() {
  for (const listener of listeners) listener();
}

export function subscribeContacts(listener: Listener): () => void {
  contactListeners.add(listener);
  return () => {
    contactListeners.delete(listener);
  };
}

function notifyContactsChanged() {
  for (const listener of contactListeners) listener();
}

// --- check-ins ---
export async function listCheckIns(): Promise<CheckIn[]> {
  return apiJson<CheckIn[]>("/api/checkins");
}

export async function getCheckIn(id: string): Promise<CheckIn | null> {
  try {
    return await apiJson<CheckIn>(`/api/checkins/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function insertCheckIn(input: NewCheckIn, createdAt?: string): Promise<CheckIn> {
  const created = await apiJson<CheckIn>("/api/checkins", {
    method: "POST",
    body: JSON.stringify({ ...input, createdAt }),
  });
  notifyChanged();
  return created;
}

export async function updateCheckIn(id: string, input: NewCheckIn, createdAt: string): Promise<void> {
  await apiSend(`/api/checkins/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ ...input, createdAt }),
  });
  notifyChanged();
}

export async function deleteCheckIn(id: string): Promise<void> {
  await apiSend(`/api/checkins/${encodeURIComponent(id)}`, { method: "DELETE" });
  notifyChanged();
}

// --- settings ---
export async function getSettings(): Promise<Settings> {
  const stored = await apiJson<Record<string, string>>("/api/settings");
  return {
    temperatureUnit: (stored.temperatureUnit as Settings["temperatureUnit"]) ?? DEFAULT_SETTINGS.temperatureUnit,
    themeName: (stored.themeName as Settings["themeName"]) ?? DEFAULT_SETTINGS.themeName,
  };
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await apiSend(`/api/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value: String(value) }),
  });
  notifyChanged();
}

// --- contacts ---
export async function listContacts(): Promise<Contact[]> {
  return apiJson<Contact[]>("/api/contacts");
}

export async function getContact(id: string): Promise<Contact | null> {
  try {
    return await apiJson<Contact>(`/api/contacts/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

// Whether the server has iCloud credentials configured (controls the Sync UI).
export async function getICloudStatus(): Promise<{ configured: boolean }> {
  try {
    return await apiJson<{ configured: boolean }>("/api/icloud/status");
  } catch {
    return { configured: false };
  }
}

export interface ContactSyncResult {
  imported: number;
  pruned: number;
  addressBooks: number;
}

// Pull the latest from iCloud into our mirror, then refresh any contact views.
export async function syncICloudContacts(): Promise<ContactSyncResult> {
  const result = await apiJson<ContactSyncResult>("/api/contacts/sync", { method: "POST" });
  notifyContactsChanged();
  return result;
}
