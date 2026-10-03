import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { handleLogin, handleLogout, isAuthed, requireAuth } from "./auth";
import {
  deleteCheckIn,
  getCheckIn,
  getSettings,
  insertCheckIn,
  listCheckIns,
  migrate,
  setSetting,
  updateCheckIn,
  type NewCheckIn,
} from "./db";

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
