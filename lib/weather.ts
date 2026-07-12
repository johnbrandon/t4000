// Open-Meteo is free and keyless, so check-ins can fetch live conditions
// without asking the user (or us) to manage API credentials.
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// WMO weather interpretation codes used by Open-Meteo.
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

export function weatherLabel(code: number | null): string {
  if (code === null) return "Unknown";
  return WEATHER_CODE_LABELS[code] ?? "Unknown";
}

export interface WeatherSnapshot {
  temperatureC: number;
  dewpointC: number;
  weatherCode: number;
  weatherCondition: string;
}

// Magnus-Tetens approximation, used as a fallback if the API response is
// ever missing dew_point_2m for a given location.
function estimateDewpointC(temperatureC: number, relativeHumidity: number): number {
  const a = 17.62;
  const b = 243.12;
  const gamma = (a * temperatureC) / (b + temperatureC) + Math.log(Math.max(relativeHumidity, 1) / 100);
  return (b * gamma) / (a - gamma);
}

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const url = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,dew_point_2m,weather_code&temperature_unit=celsius&timezone=auto`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Weather request failed with status ${response.status}`);
    }
    const data = await response.json();
    const current = data.current ?? {};
    const temperatureC: number = current.temperature_2m;
    const weatherCode: number = current.weather_code;
    const dewpointC: number =
      typeof current.dew_point_2m === "number"
        ? current.dew_point_2m
        : estimateDewpointC(temperatureC, current.relative_humidity_2m ?? 50);

    return {
      temperatureC,
      dewpointC,
      weatherCode,
      weatherCondition: weatherLabel(weatherCode),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
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

// Pick the hour closest to `when` from an Open-Meteo hourly response.
function snapshotFromHourly(data: HourlyResponse, when: Date): WeatherSnapshot | null {
  const hourly = data.hourly;
  if (!hourly?.time?.length) return null;
  const target = `${localDateKey(when)}T${`${when.getHours()}`.padStart(2, "0")}:00`;

  let index = hourly.time.indexOf(target);
  if (index === -1) {
    // Fall back to the numerically nearest timestamp.
    const targetMs = when.getTime();
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
    typeof dp === "number"
      ? dp
      : estimateDewpointC(temperatureC, hourly.relative_humidity_2m?.[index] ?? 50);

  return { temperatureC, dewpointC, weatherCode, weatherCondition: weatherLabel(weatherCode) };
}

async function fetchHourly(url: string): Promise<HourlyResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as HourlyResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Historical weather for a past date/time & location. Open-Meteo's archive API
// covers older dates; very recent days (not yet archived) are served by the
// forecast API's date range, so we try the archive first and fall back.
export async function fetchWeatherAt(
  latitude: number,
  longitude: number,
  when: Date
): Promise<WeatherSnapshot | null> {
  const day = localDateKey(when);
  const hourlyVars = "temperature_2m,dew_point_2m,relative_humidity_2m,weather_code";

  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${day}&end_date=${day}&hourly=${hourlyVars}&timezone=auto`;
  const archive = await fetchHourly(archiveUrl);
  const fromArchive = archive && snapshotFromHourly(archive, when);
  if (fromArchive) return fromArchive;

  const forecastUrl = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&start_date=${day}&end_date=${day}&hourly=${hourlyVars}&timezone=auto`;
  const forecast = await fetchHourly(forecastUrl);
  return forecast ? snapshotFromHourly(forecast, when) : null;
}

// Daily mean temperature for every day of a year at one location (Open-Meteo
// archive), used to backfill the calendar on days without a check-in. Cached
// per location+year for the session.
const dailyMeanCache = new Map<string, Map<string, number>>();

interface DailyResponse {
  daily?: { time?: string[]; temperature_2m_mean?: (number | null)[] };
}

function mergeDaily(target: Map<string, number>, data: DailyResponse | null) {
  const times = data?.daily?.time ?? [];
  const means = data?.daily?.temperature_2m_mean ?? [];
  times.forEach((t, i) => {
    const v = means[i];
    if (typeof v === "number") target.set(t, v);
  });
}

async function fetchDaily(url: string): Promise<DailyResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as DailyResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDailyMeanTemps(
  latitude: number,
  longitude: number,
  year: number
): Promise<Map<string, number>> {
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)},${year}`;
  const cached = dailyMeanCache.get(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const nowYear = now.getFullYear();
  if (year > nowYear) return new Map(); // no history for a future year

  const map = new Map<string, number>();

  // End date is today for the current year (the archive only rejects dates
  // strictly in the future), or the year's end for past years.
  const archiveEnd = year < nowYear ? `${year}-12-31` : localDateKey(now);
  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${year}-01-01&end_date=${archiveEnd}&daily=temperature_2m_mean&timezone=auto`;
  mergeDaily(map, await fetchDaily(archiveUrl));

  // The archive lags a few days; fill the most recent days for the current year
  // from the forecast API so every day up to today is covered.
  if (year === nowYear) {
    const forecastUrl = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_mean&past_days=14&forecast_days=1&timezone=auto`;
    mergeDaily(map, await fetchDaily(forecastUrl));
  }

  if (map.size > 0) dailyMeanCache.set(cacheKey, map);
  return map;
}

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function formatTemperature(celsius: number | null, unit: "C" | "F"): string {
  if (celsius === null) return "—";
  const value = unit === "F" ? celsiusToFahrenheit(celsius) : celsius;
  return `${Math.round(value)}°${unit}`;
}
