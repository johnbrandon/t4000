# Check In

A React Native + Expo progressive web app for time-tracking via location
check-ins, inspired by **Foursquare** (place check-ins), **Strava** (activity
feed) and **Whoop** (personal metrics). Each check-in is stored locally and
rolls up into a life-in-weeks visualization inspired by Oliver Burkeman's
_Four Thousand Weeks_.

## What a check-in captures

- Latitude & longitude (via `expo-location`)
- Place label (keyless reverse geocoding)
- Temperature, weather condition & dewpoint (Open-Meteo, keyless)
- Length of activity (manual entry or built-in stopwatch)
- Type of activity (Run, Ride, Strength, Work, Meal, …)
- Purpose of the activity
- Other participants

## Screens

- **Feed** — reverse-chronological activity feed with week stats and a streak.
- **Check In** — capture a new check-in; auto-fetches location and weather.
- **4000 Weeks** — a grid where every square is a week of your life; weeks you
  checked in are colored by their dominant activity. Tap a week to inspect it.
- **Profile** — birth date, life-expectancy in weeks, temperature unit, and a
  breakdown of where your time goes.

## Tech

- **Expo SDK 57** with **expo-router** (file-based routing under `app/`)
- **expo-sqlite** for persistence — native on iOS/Android, `wa-sqlite` (WASM +
  OPFS) on web, so data survives reloads without a server
- **PWA**: web export runs as an installable, offline-capable single-page app
  (`public/manifest.json`, `public/sw.js`, runtime head injection in
  `lib/pwa.ts`)

No API keys are required: weather comes from Open-Meteo and reverse geocoding
from BigDataCloud's free client endpoints.

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

## Project layout

```
app/                     expo-router routes
  _layout.tsx            root stack + PWA registration
  (tabs)/                bottom-tab navigator
    index.tsx            Feed
    check-in.tsx         New check-in
    weeks.tsx            4000 Weeks visualization
    profile.tsx          Profile & settings
components/              presentational UI (cards, chips, grid, icons)
lib/                     data + domain logic
  db.ts                 SQLite schema, CRUD, change subscription
  weather.ts            Open-Meteo client + unit helpers
  location.ts           geolocation + reverse geocoding
  weeksGrid.ts          bucket check-ins into life-weeks
  stats.ts              feed stats (streaks, weekly totals)
  time.ts               week math & formatting
  theme.ts              design tokens
public/                 PWA manifest, service worker, icons
```
