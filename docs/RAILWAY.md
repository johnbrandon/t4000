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
   - `PORT` is injected by Railway automatically — don't set it.
5. **Deploy.** Railway builds the image (web export + server) and starts it. The
   health check hits `/api/health`. When it's green, open the generated URL (or add a
   custom domain under _Settings_ → _Networking_).

## How it runs

- The server listens on `$PORT`, runs the DB migration on boot, and serves:
  - `/api/*` — the JSON API (everything except `/api/health`, `/api/login`,
    `/api/me` requires the session cookie).
  - everything else — the static web app, with SPA fallback to `index.html`.
- Auth is a single shared password → an HMAC-signed, httpOnly session cookie (90-day
  expiry). Because the web app is same-origin with the API, the cookie "just works"
  with no CORS and no token handling in the browser.

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
