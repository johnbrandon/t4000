# Hosting on Railway

The app is now a single service: an Express server that serves the JSON API **and**
the built web app from the same origin, backed by Postgres. Railway builds it from
the `Dockerfile` at the repo root.

## One-time setup

1. **Create a project** at [railway.com](https://railway.com) → _New Project_.
2. **Add Postgres**: in the project, _New_ → _Database_ → _Add PostgreSQL_. Railway
   provisions it and exposes a `DATABASE_URL`.
3. **Add the app service**: _New_ → _GitHub Repo_ → select `johnbrandon/t4000` and the
   branch you want to deploy. Railway detects `railway.json` + `Dockerfile` and builds.
4. **Set the service variables** (service → _Variables_):
   - `DATABASE_URL` → reference the database: set the value to `${{Postgres.DATABASE_URL}}`
     (use whatever your Postgres service is named).
   - `APP_PASSWORD` → the password you'll use to log into the app.
   - `SESSION_SECRET` → a long random string. Generate one with:
     ```
     openssl rand -hex 32
     ```
   - `NODE_ENV` → `production` (so the auth cookie is sent `Secure`).
   - `ICLOUD_USERNAME` / `ICLOUD_APP_PASSWORD` _(optional — enables the Contacts
     import; see below)_.
   - `FOURSQUARE_API_KEY` _(optional — enables the nearby-venue picker on check-in;
     see below)_.
   - `PORT` is injected by Railway automatically — don't set it.
5. **Deploy.** Railway builds the image (web export + server) and starts it. The
   health check hits `/api/health`. When it's green, open the generated URL (or add a
   custom domain under _Settings_ → _Networking_).

## How it runs

- The server listens on `$PORT`, runs the DB migration on boot, and serves:
  - `/api/*` — the JSON API (everything except `/api/health`, `/api/login`,
    `/api/me` requires the session cookie).
  - everything else — the static web app, with SPA fallback to `index.html`.
- Weather (Open-Meteo) and the 10-year Treasury yield (FRED series DGS10) are
  fetched **server-side** and cached, then exposed under `/api/weather/*` and
  `/api/treasury` (both behind auth). The browser no longer calls those APIs
  directly, which removes the old CORS proxy for FRED. No extra keys are needed —
  both upstreams are keyless.
- Auth is a single shared password → an HMAC-signed, httpOnly session cookie (90-day
  expiry). Because the web app is same-origin with the API, the cookie "just works"
  with no CORS and no token handling in the browser.

## Contacts (iCloud import)

The Contacts tab mirrors your iCloud contacts into Postgres, **read-only** — the app
only ever reads from iCloud, it never writes back. iCloud has no contacts OAuth and
its CardDAV endpoint sends no CORS headers, so the import runs server-side over
CardDAV using an app-specific password (never your Apple ID account password).

To enable it, set two variables on the app service:

- `ICLOUD_USERNAME` → your Apple ID (e.g. `you@icloud.com`).
- `ICLOUD_APP_PASSWORD` → an app-specific password from
  [appleid.apple.com](https://appleid.apple.com) → _Sign-In & Security_ →
  _App-Specific Passwords_. Keep the dashes.

These live only as server-side env vars — they're never exposed to the browser. With
them set, the Contacts tab shows a **Sync iCloud** button; tapping it fetches your
vCards, upserts them keyed on each contact's iCloud UID (so repeat syncs don't
duplicate), and removes any that were deleted upstream. Without them, the tab explains
that iCloud isn't configured.

## Places (Foursquare nearby-venue picker)

On a "Now" check-in, the app can list nearby venues (from Foursquare Places) so you
can name the exact place you're at instead of just the street address. Picking a
venue sets the check-in's label, and — only when you haven't chosen an interaction
yet — suggests one from the venue's category (a café → Coffee, an office → Meeting).

To enable it, set one variable on the app service:

- `FOURSQUARE_API_KEY` → a Places API key from
  [foursquare.com/developers](https://foursquare.com/developers/). It's used as a
  Bearer token against the current Places API (`places-api.foursquare.com`), proxied
  server-side (`/api/places/search`) so the key never reaches the browser, with
  short-lived caching.
- `FOURSQUARE_API_VERSION` → optional; overrides the dated API-version header if
  Foursquare bumps it (defaults to a known-good value).

Without the key, the check-in screen simply skips the venue picker and uses the
reverse-geocoded address, exactly as before.

## Notes

- Existing check-ins currently live in your browser's local storage (OPFS) and are
  **not** migrated automatically. If you want to keep them, we can add a one-time
  import.
- The old GitHub Pages deploy (`.github/workflows/deploy-pages.yml`) still publishes a
  static copy with no backend; retire it once Railway is live.

## Local development

Run Postgres, then the server, pointing it at a local web build:

```bash
# from repo root — build the web app once
npm run build:web

# from server/
cd server && npm install
DATABASE_URL=postgres://postgres@localhost:5432/t4000 \
APP_PASSWORD=dev SESSION_SECRET=devsecret \
STATIC_DIR=../dist \
npm start
# open http://localhost:3000
```
