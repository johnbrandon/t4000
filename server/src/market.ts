// Server-side fetching of external market/weather data, so the browser never
// talks to these APIs directly (no CORS workarounds, no third-party proxy for
// FRED) and results are cached across users. All of this used to run in the
// client (lib/weather.ts, lib/treasury.ts); the logic is ported verbatim.
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

// --- small TTL cache ---
interface Entry<T> {
  value: T;
  expires: number;
}
function cacheFactory<T>() {
  return new Map<string, Entry<T>>();
}
async function cached<T>(
  store: Map<string, Entry<T>>,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  keep: (value: T) => boolean
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = await load();
  if (keep(value)) store.set(key, { value, expires: now + ttlMs });
  return value;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function getJson(url: string, timeoutMs = 12000): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url: string, timeoutMs = 12000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- weather ---
const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Thunderstorm w/ hail",
};

function weatherLabel(code: number | null): string {
  if (code === null) return "Unknown";
  return WEATHER_CODE_LABELS[code] ?? "Unknown";
}

// Magnus-Tetens approximation, used if a response lacks dew_point_2m.
function estimateDewpointC(temperatureC: number, relativeHumidity: number): number {
  const a = 17.62;
  const b = 243.12;
  const gamma = (a * temperatureC) / (b + temperatureC) + Math.log(Math.max(relativeHumidity, 1) / 100);
  return (b * gamma) / (a - gamma);
}

export interface WeatherSnapshot {
  temperatureC: number;
  dewpointC: number;
  weatherCode: number;
  weatherCondition: string;
}

function pad2(n: number): string {
  return `${n}`.padStart(2, "0");
}

const currentCache = cacheFactory<WeatherSnapshot | null>();

// Live conditions for a coordinate. Cached ~10 min per rounded location.
export async function currentWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  return cached(
    currentCache,
    key,
    10 * 60 * 1000,
    async () => {
      const url = `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,weather_code&temperature_unit=celsius&timezone=auto`;
      const data = (await getJson(url, 10000)) as { current?: Record<string, number> } | null;
      const current = data?.current;
      if (!current || typeof current.temperature_2m !== "number" || typeof current.weather_code !== "number") {
        return null;
      }
      const temperatureC = current.temperature_2m;
      const weatherCode = current.weather_code;
      const dewpointC =
        typeof current.dew_point_2m === "number"
          ? current.dew_point_2m
          : estimateDewpointC(temperatureC, current.relative_humidity_2m ?? 50);
      return { temperatureC, dewpointC, weatherCode, weatherCondition: weatherLabel(weatherCode) };
    },
    (v) => v !== null
  );
}

interface HourlyResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    dew_point_2m?: (number | null)[];
    relative_humidity_2m?: (number | null)[];
    weather_code?: (number | null)[];
  };
}

// Pick the hour matching the given local wall-clock date + hour (the components
// the user actually entered); fall back to the nearest hour within that day.
function snapshotFromHourly(data: HourlyResponse, date: string, hour: number): WeatherSnapshot | null {
  const hourly = data.hourly;
  if (!hourly?.time?.length) return null;
  const target = `${date}T${pad2(hour)}:00`;

  let index = hourly.time.indexOf(target);
  if (index === -1) {
    const targetMs = new Date(target).getTime();
    let best = Infinity;
    hourly.time.forEach((t, i) => {
      const diff = Math.abs(new Date(t).getTime() - targetMs);
      if (diff < best) {
        best = diff;
        index = i;
      }
    });
  }
  if (index === -1) return null;

  const temperatureC = hourly.temperature_2m?.[index];
  const weatherCode = hourly.weather_code?.[index];
  if (typeof temperatureC !== "number" || typeof weatherCode !== "number") return null;

  const dp = hourly.dew_point_2m?.[index];
  const dewpointC =
    typeof dp === "number" ? dp : estimateDewpointC(temperatureC, hourly.relative_humidity_2m?.[index] ?? 50);
  return { temperatureC, dewpointC, weatherCode, weatherCondition: weatherLabel(weatherCode) };
}

const atCache = cacheFactory<WeatherSnapshot | null>();

// Historical conditions for a specific local date + hour at a coordinate. Tries
// the archive API first (older dates), then the forecast API (recent days not
// yet archived). Cached a day per location+date+hour.
export async function weatherAt(lat: number, lon: number, date: string, hour: number): Promise<WeatherSnapshot | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${date}T${pad2(hour)}`;
  return cached(
    atCache,
    key,
    DAY,
    async () => {
      const hourlyVars = "temperature_2m,dew_point_2m,relative_humidity_2m,weather_code";
      const archiveUrl = `${ARCHIVE_URL}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=${hourlyVars}&timezone=auto`;
      const archive = (await getJson(archiveUrl)) as HourlyResponse | null;
      const fromArchive = archive && snapshotFromHourly(archive, date, hour);
      if (fromArchive) return fromArchive;

      const forecastUrl = `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=${hourlyVars}&timezone=auto`;
      const forecast = (await getJson(forecastUrl)) as HourlyResponse | null;
      return forecast ? snapshotFromHourly(forecast, date, hour) : null;
    },
    (v) => v !== null
  );
}

interface DailyResponse {
  daily?: Record<string, (number | null)[] | string[] | undefined> & { time?: string[] };
}

function mergeVar(target: Record<string, number>, data: DailyResponse | null, variable: string) {
  const times = (data?.daily?.time ?? []) as string[];
  const values = (data?.daily?.[variable] ?? []) as (number | null)[];
  times.forEach((t, i) => {
    const v = values[i];
    if (typeof v === "number") target[t] = v;
  });
}

export interface DailyWeatherData {
  meanTempC: Record<string, number>;
  precipMm: Record<string, number>;
}

const DAILY_VARS = "temperature_2m_mean,precipitation_sum";
const dailyCache = cacheFactory<DailyWeatherData>();

// Daily mean temperature + precipitation for a whole year at a location. Past
// years are effectively immutable (cached long); the current year is cached a
// few hours and backfilled from the forecast API for the un-archived tail.
export async function dailyWeather(lat: number, lon: number, year: number): Promise<DailyWeatherData> {
  const nowYear = new Date().getFullYear();
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${year}`;
  const ttl = year < nowYear ? 30 * DAY : 6 * HOUR;
  return cached(
    dailyCache,
    key,
    ttl,
    async () => {
      const result: DailyWeatherData = { meanTempC: {}, precipMm: {} };
      if (year > nowYear) return result;

      const now = new Date();
      const archiveEnd =
        year < nowYear
          ? `${year}-12-31`
          : `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      const archiveUrl = `${ARCHIVE_URL}?latitude=${lat}&longitude=${lon}&start_date=${year}-01-01&end_date=${archiveEnd}&daily=${DAILY_VARS}&timezone=auto`;
      const archive = (await getJson(archiveUrl)) as DailyResponse | null;
      mergeVar(result.meanTempC, archive, "temperature_2m_mean");
      mergeVar(result.precipMm, archive, "precipitation_sum");

      if (year === nowYear) {
        const forecastUrl = `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&daily=${DAILY_VARS}&past_days=14&forecast_days=1&timezone=auto`;
        const forecast = (await getJson(forecastUrl)) as DailyResponse | null;
        mergeVar(result.meanTempC, forecast, "temperature_2m_mean");
        mergeVar(result.precipMm, forecast, "precipitation_sum");
      }
      return result;
    },
    (v) => Object.keys(v.meanTempC).length > 0 || Object.keys(v.precipMm).length > 0
  );
}

// --- treasury (FRED DGS10) ---
function parseFredCsv(text: string): Record<string, number> {
  const map: Record<string, number> = {};
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const [date, value] = lines[i].split(",");
    if (!date) continue;
    const n = parseFloat(value);
    if (Number.isFinite(n)) map[date.trim()] = n;
  }
  return map;
}

const treasuryCache = cacheFactory<Record<string, number>>();

// Daily 10-year Treasury yield (FRED series DGS10) for a year, as a date->percent
// map. Server-side fetch, so no CORS and no third-party proxy. FRED's CSV export
// is keyless. Past years cached long; the current year a few hours.
export async function treasuryYields(year: number): Promise<Record<string, number>> {
  const nowYear = new Date().getFullYear();
  const ttl = year < nowYear ? 30 * DAY : 6 * HOUR;
  return cached(
    treasuryCache,
    String(year),
    ttl,
    async () => {
      const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=${year}-01-01&coed=${year}-12-31`;
      const text = await getText(url);
      if (!text || !text.includes("DGS10")) return {};
      return parseFredCsv(text);
    },
    (v) => Object.keys(v).length > 0
  );
}
