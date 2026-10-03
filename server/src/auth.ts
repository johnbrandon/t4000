import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE = "t4000_session";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

const APP_PASSWORD = process.env.APP_PASSWORD ?? "";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";
const isProd = process.env.NODE_ENV === "production";

if (!APP_PASSWORD || !SESSION_SECRET) {
  // Fail fast: an open API over real data is the thing we're specifically avoiding.
  throw new Error("APP_PASSWORD and SESSION_SECRET must both be set");
}

function sign(payload: string): string {
  const mac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

// A session token is `<issuedAtMs>.<hmac>`; the signature covers the issued time
// so we can both authenticate and expire it.
function makeToken(): string {
  return sign(String(Date.now()));
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const expected = sign(payload);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const issued = Number(payload);
  if (!Number.isFinite(issued)) return false;
  return Date.now() - issued < MAX_AGE_MS;
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function handleLogin(req: Request, res: Response): void {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!constantTimeEquals(password, APP_PASSWORD)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  res.cookie(COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: MAX_AGE_MS,
    path: "/",
  });
  res.json({ ok: true });
}

export function handleLogout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}

export function isAuthed(req: Request): boolean {
  return verifyToken(req.cookies?.[COOKIE]);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthed(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated" });
}
