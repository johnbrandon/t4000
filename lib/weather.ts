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
export interface DailyWeather {
  meanTempC: Map<string, number>; // temperature_2m_mean (°C)
  precipMm: Map<string, number>; // precipitation_sum (mm)
}

const dailyWeatherCache = new Map<string, DailyWeather>();

const DAILY_VARS = "temperature_2m_mean,precipitation_sum";

interface DailyResponse {
  daily?: Record<string, (number | null)[] | string[] | undefined> & { time?: string[] };
}

function mergeVar(target: Map<string, number>, data: DailyResponse | null, variable: string) {
  const times = (data?.daily?.time ?? []) as string[];
  const values = (data?.daily?.[variable] ?? []) as (number | null)[];
  times.forEach((t, i) => {
    const v = values[i];
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

// Daily mean temperature and total precipitation for every day of a year at a
// location. End date is today for the current year; the recent archive lag is
// filled from the forecast API. Cached per location+year.
export async function fetchDailyWeather(latitude: number, longitude: number, year: number): Promise<DailyWeather> {
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)},${year}`;
  const cached = dailyWeatherCache.get(cacheKey);
  if (cached) return cached;

  const result: DailyWeather = { meanTempC: new Map(), precipMm: new Map() };
  const now = new Date();
  const nowYear = now.getFullYear();
  if (year > nowYear) return result; // no history for a future year

  const archiveEnd = year < nowYear ? `${year}-12-31` : localDateKey(now);
  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${year}-01-01&end_date=${archiveEnd}&daily=${DAILY_VARS}&timezone=auto`;
  const archive = await fetchDaily(archiveUrl);
  mergeVar(result.meanTempC, archive, "temperature_2m_mean");
  mergeVar(result.precipMm, archive, "precipitation_sum");

  if (year === nowYear) {
    const forecastUrl = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&daily=${DAILY_VARS}&past_days=14&forecast_days=1&timezone=auto`;
    const forecast = await fetchDaily(forecastUrl);
    mergeVar(result.meanTempC, forecast, "temperature_2m_mean");
    mergeVar(result.precipMm, forecast, "precipitation_sum");
  }

  if (result.meanTempC.size > 0 || result.precipMm.size > 0) dailyWeatherCache.set(cacheKey, result);
  return result;
}

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function formatTemperature(celsius: number | null, unit: "C" | "F"): string {
  if (celsius === null) return "—";
  const value = unit === "F" ? celsiusToFahrenheit(celsius) : celsius;
  return `${Math.round(value)}°${unit}`;
}
