# Check In

A React Native + Expo progressive web app for time-tracking via location
check-ins, inspired by **Foursquare** (place check-ins), **Strava** (activity
feed) and **Whoop** (personal metrics). Each check-in is stored locally and
rolls up into a year-at-a-glance calendar — one square per day, shaded like a
GitHub contribution graph by how many buyer/seller interactions you logged that
day. The whole app follows a **Vitsœ / Dieter Rams** industrial-minimalist
design language — "as little design as possible": an austere monochrome scheme
on a plain white ground, with charcoal ink, neutral grays, hairline rules,
generous whitespace, and the platform's own system font. Color is reserved for
two deliberate places — the green contribution grid and the temperature
heatmap — so it always means something. A second, switchable **Night** scheme
recasts everything as red on true black, Apple Watch night-mode style.

## What a check-in captures

- Latitude & longitude (device geolocation, or entered manually for past check-ins)
- Street address for those coordinates (keyless reverse geocoding via OpenStreetMap Nominatim)
- Temperature, weather condition & dewpoint (Open-Meteo — current or historical, keyless)
- Length of activity (manual entry, in minutes)
- Type of activity (Run, Ride, Strength, Work, Meal, …)
- Purpose of the activity
- Other participants

## Screens

- **Feed** — infinitely-scrolling activity feed with week stats, **sortable** by
  newest/oldest/longest/shortest. Tap any check-in to edit or delete it.
- **Check In** — capture a check-in **now** (auto-fetches location + weather), or
  **in the past** by entering a date, time, and coordinates — the street address
  is resolved live and historical temperature/weather/dewpoint are looked up from
  Open-Meteo's archive. Location is best-effort: a check-in still saves without it.
  **Choose one or more** interaction tags (Biz dev, Buyer, Coffee, Landlord,
  Meeting, Other, Seller, Social, Sphere, Travel) and rate the
  **interaction quality** on a 1…5 scale. Length of activity is optional.
- **This Year** — a 12-month × 31-day calendar (months across, days down) where
  each square is shaded like a GitHub contribution graph: the more **buyer &
  seller** interactions you logged that day, the darker the shade of green.
  Below it, a stack of tiles:
  interaction quality (diverging around a neutral 0 line), average temperature,
  rainfall, the daily 10-year Treasury yield (FRED), and Buyer/Seller appointment
  counts — each its own chart. Tap a day to inspect its check-ins.
- **Profile** — appearance (Light / Night) and temperature unit, plus "where
  your time goes" (by activity) and "who you spend your time with" (people
  tagged in check-ins, ranked by total time spent together, names shown as
  first initial + last name).
- **Map** — an interactive map (Leaflet + OpenStreetMap on web) with a pin for
  every check-in that recorded coordinates, colored by activity.

## Tech

- **Expo SDK 57** with **expo-router** (file-based routing under `app/`)
- Two switchable color schemes (persisted, toggled on the Profile screen): a
  **Vitsœ / Rams**–inspired austere monochrome **Light** scheme (plain white
  ground, charcoal ink) and an Apple-Watch-style **Night** scheme (red on true
  black). Flat colors are driven by CSS custom properties so the whole UI
  re-themes instantly; SVG charts and the map read concrete palette values.
  Set in the system font, with **Material Design icons**
  (`@expo/vector-icons` MaterialCommunityIcons)
- **expo-sqlite** for persistence — native on iOS/Android, `wa-sqlite` (WASM +
  OPFS) on web, so data survives reloads without a server
- **PWA**: web export runs as an installable, offline-capable single-page app
  (`public/manifest.json`, `public/sw.js`, runtime head injection in
  `lib/pwa.ts`)

No API keys are required: weather comes from Open-Meteo and reverse geocoding
from BigDataCloud's free client endpoints.

## Hosted PWA

Every push to the default branch builds the web export and publishes it to
GitHub Pages via `.github/workflows/deploy-pages.yml`:

> **https://johnbrandon.github.io/t4000/**

Open that on a phone and use *Add to Home Screen* (Safari) / *Install app*
(Chrome) to run it fullscreen, offline-capable, with no local server. Because
project sites are served from a `/t4000/` sub-path, the build sets
`EXPO_BASE_URL` (via `app.config.js`, layered over `app.json`) so router and
PWA asset URLs resolve correctly; local runs stay anchored at `/`.

## Running

```bash
npm install

# Native / Expo Go
npm run start

# Web (dev)
npm run web

# Static PWA export -> ./dist
npm run build:web

# Type-check
npm run typecheck
```

To reproduce the hosted build locally (served under `/t4000/`):

```bash
EXPO_BASE_URL=/t4000 EXPO_PUBLIC_BASE_URL=/t4000 npx expo export -p web
```

## Project layout

```
app/                     expo-router routes
  _layout.tsx            root stack + PWA registration
  (tabs)/                bottom-tab navigator
    index.tsx            Feed
    check-in.tsx         New check-in (now / in the past)
    year.tsx             This Year (temperature calendar) visualization
    map.tsx              Map of located check-ins
    profile.tsx          Profile & settings
components/              presentational UI (cards, chips, grid, icons)
  YearGrid.tsx          12×31 month/day contribution-style grid
  MapView.web.tsx       Leaflet map (web); MapView.tsx is the native fallback
lib/                     data + domain logic
  db.ts                 SQLite schema, migrations, CRUD, change subscription
  weather.ts            Open-Meteo client (current + historical) + unit helpers
  location.ts           geolocation (web + native) + reverse geocoding
  dayGrid.ts            bucket check-ins into calendar days + avg temperature
  mapPoints.ts          derive map pins from check-ins
  stats.ts              feed stats (streaks, weekly totals)
  time.ts               duration & relative-time formatting
  theme.ts              design tokens + temperature gradient
public/                 PWA manifest, service worker, icons
```
