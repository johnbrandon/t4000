// Thin client for the backend API. The web app is served from the same origin
// as the API in production, so requests are relative ("/api/...") and the
// session cookie is sent automatically. EXPO_PUBLIC_API_URL can point at a
// different origin for local development against a remote server.
const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

let onUnauthorized: (() => void) | null = null;

// The auth gate registers here so an expired session mid-session bounces the
// user back to the login screen instead of silently failing.
export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorized = cb;
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    // Surface the server's { error } message when it sends one, so callers can
    // show a useful reason instead of a bare status code.
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.clone().json();
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      /* non-JSON body; keep the status message */
    }
    throw new Error(message);
  }
  return res;
}

export async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await request(path, options);
  return res.json() as Promise<T>;
}

export async function apiSend(path: string, options?: RequestInit): Promise<void> {
  await request(path, options);
}

// --- auth (these must not trigger the onUnauthorized bounce) ---
export async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function login(password: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" });
  } catch {
    /* ignore */
  }
}
