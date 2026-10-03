import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { handleLogin, handleLogout, isAuthed, requireAuth } from "./auth";
import {
  deleteCheckIn,
  getCheckIn,
  getContact,
  getSettings,
  insertCheckIn,
  listCheckIns,
  listContacts,
  migrate,
  setSetting,
  updateCheckIn,
  type NewCheckIn,
} from "./db";
import { icloudConfigured, syncContacts } from "./icloud";
import { currentWeather, dailyWeather, treasuryYields, weatherAt } from "./market";
import { placesConfigured, searchNearby } from "./places";

const PORT = Number(process.env.PORT ?? 3000);
const STATIC_DIR = process.env.STATIC_DIR ?? path.resolve(__dirname, "../../dist");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// --- auth ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.post("/api/login", handleLogin);
app.post("/api/logout", handleLogout);
app.get("/api/me", (req, res) => {
  if (isAuthed(req)) res.json({ ok: true });
  else res.status(401).json({ error: "Not authenticated" });
});

// Everything below requires a valid session.
app.use("/api", requireAuth);

// --- check-ins ---
app.get(
  "/api/checkins",
  wrap(async (_req, res) => {
    res.json(await listCheckIns());
  })
);

app.post(
  "/api/checkins",
  wrap(async (req, res) => {
    const { createdAt, ...input } = req.body ?? {};
    const created = await insertCheckIn(input as NewCheckIn, typeof createdAt === "string" ? createdAt : undefined);
    res.status(201).json(created);
  })
);

app.get(
  "/api/checkins/:id",
  wrap(async (req, res) => {
    const found = await getCheckIn(req.params.id);
    if (!found) res.status(404).json({ error: "Not found" });
    else res.json(found);
  })
);

app.put(
  "/api/checkins/:id",
  wrap(async (req, res) => {
    const { createdAt, ...input } = req.body ?? {};
    if (typeof createdAt !== "string") {
      res.status(400).json({ error: "createdAt is required" });
      return;
    }
    const updated = await updateCheckIn(req.params.id, input as NewCheckIn, createdAt);
    if (!updated) res.status(404).json({ error: "Not found" });
    else res.json(updated);
  })
);

app.delete(
  "/api/checkins/:id",
  wrap(async (req, res) => {
    await deleteCheckIn(req.params.id);
    res.json({ ok: true });
  })
);

// --- settings ---
app.get(
  "/api/settings",
  wrap(async (_req, res) => {
    res.json(await getSettings());
  })
);

app.put(
  "/api/settings/:key",
  wrap(async (req, res) => {
    const value = req.body?.value;
    if (typeof value !== "string") {
      res.status(400).json({ error: "value (string) is required" });
      return;
    }
    await setSetting(req.params.key, value);
    res.json({ ok: true });
  })
);

// --- contacts ---
app.get(
  "/api/icloud/status",
  wrap(async (_req, res) => {
    res.json({ configured: icloudConfigured() });
  })
);

app.post(
  "/api/contacts/sync",
  wrap(async (_req, res) => {
    if (!icloudConfigured()) {
      res.status(400).json({ error: "iCloud is not configured on the server." });
      return;
    }
    try {
      const result = await syncContacts();
      res.json(result);
    } catch (err) {
      console.error("[t4000] iCloud sync failed:", err);
      const detail = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `iCloud sync failed: ${detail}` });
    }
  })
);

app.get(
  "/api/contacts",
  wrap(async (_req, res) => {
    res.json(await listContacts());
  })
);

app.get(
  "/api/contacts/:id",
  wrap(async (req, res) => {
    const found = await getContact(req.params.id);
    if (!found) res.status(404).json({ error: "Not found" });
    else res.json(found);
  })
);

// --- market data (weather + treasury), fetched server-side and cached ---
function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

app.get(
  "/api/weather/current",
  wrap(async (req, res) => {
    const lat = num(req.query.lat);
    const lon = num(req.query.lon);
    if (lat === null || lon === null) {
      res.status(400).json({ error: "lat and lon are required" });
      return;
    }
    res.json(await currentWeather(lat, lon));
  })
);

app.get(
  "/api/weather/at",
  wrap(async (req, res) => {
    const lat = num(req.query.lat);
    const lon = num(req.query.lon);
    const date = typeof req.query.date === "string" ? req.query.date : "";
    const hour = num(req.query.hour);
    if (lat === null || lon === null || !/^\d{4}-\d{2}-\d{2}$/.test(date) || hour === null) {
      res.status(400).json({ error: "lat, lon, date (YYYY-MM-DD) and hour are required" });
      return;
    }
    res.json(await weatherAt(lat, lon, date, Math.max(0, Math.min(23, Math.round(hour)))));
  })
);

app.get(
  "/api/weather/daily",
  wrap(async (req, res) => {
    const lat = num(req.query.lat);
    const lon = num(req.query.lon);
    const year = num(req.query.year);
    if (lat === null || lon === null || year === null) {
      res.status(400).json({ error: "lat, lon and year are required" });
      return;
    }
    res.json(await dailyWeather(lat, lon, Math.round(year)));
  })
);

app.get(
  "/api/treasury",
  wrap(async (req, res) => {
    const year = num(req.query.year);
    if (year === null) {
      res.status(400).json({ error: "year is required" });
      return;
    }
    res.json(await treasuryYields(Math.round(year)));
  })
);

// --- places (Foursquare), proxied server-side so the key stays off the client ---
app.get(
  "/api/places/status",
  wrap(async (_req, res) => {
    res.json({ configured: placesConfigured() });
  })
);

app.get(
  "/api/places/search",
  wrap(async (req, res) => {
    const lat = num(req.query.lat);
    const lon = num(req.query.lon);
    if (lat === null || lon === null) {
      res.status(400).json({ error: "lat and lon are required" });
      return;
    }
    if (!placesConfigured()) {
      res.status(400).json({ error: "Foursquare is not configured on the server." });
      return;
    }
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const limit = num(req.query.limit);
    try {
      res.json(await searchNearby(lat, lon, query, limit ?? 10));
    } catch (err) {
      console.error("[t4000] Foursquare search failed:", err);
      const detail = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `Place search failed: ${detail}` });
    }
  })
);

// --- static web app (same origin as the API) ---
const hasBuild = fs.existsSync(path.join(STATIC_DIR, "index.html"));
if (hasBuild) {
  app.use(express.static(STATIC_DIR));
  // SPA fallback: any non-API GET returns index.html so client routing works.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });
} else {
  console.warn(`[t4000] No web build found at ${STATIC_DIR}; serving API only.`);
}

// JSON error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[t4000] request error:", err);
  res.status(500).json({ error: "Internal server error" });
});

migrate()
  .then(() => {
    app.listen(PORT, () => console.log(`[t4000] listening on :${PORT} (static: ${hasBuild ? STATIC_DIR : "none"})`));
  })
  .catch((err) => {
    console.error("[t4000] failed to start:", err);
    process.exit(1);
  });
