import { useCallback, useEffect, useState } from "react";
import {
  getSettings,
  listCheckIns,
  listContacts,
  setSetting,
  subscribeCheckIns,
  subscribeContacts,
} from "./db";
import type { CheckIn, Contact, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export function useCheckIns() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    listCheckIns()
      .then(setCheckIns)
      .catch((err) => console.warn("Failed to load check-ins", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeCheckIns(refresh);
  }, [refresh]);

  return { checkIns, loading, refresh };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getSettings()
      .then(setSettings)
      .catch((err) => console.warn("Failed to load settings", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeCheckIns(refresh);
  }, [refresh]);

  const update = useCallback(async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    await setSetting(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { settings, loading, update };
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    listContacts()
      .then(setContacts)
      .catch((err) => console.warn("Failed to load contacts", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeContacts(refresh);
  }, [refresh]);

  return { contacts, loading, refresh };
}
