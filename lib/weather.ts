// Weather for the app. Fetching now happens on the server (see server/src/market.ts)
// and is reached through our authenticated API; this module keeps the same exported
// surface the screens already use, plus the pure formatting helpers that stay on the
// client. A small per-session cache avoids refetching when screens remount.
import { apiJson } from "./api";

// WMO weather interpretation codes used by Open-Meteo (kept for any client-side
// labeling; the server also sends a ready-made weatherCondition).
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

function pad2(n: number): string {
  return `${n}`.padStart(2, "0");
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Live conditions at a coordinate. Throws on failure (callers catch), matching
// the previous contract.
export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const snap = await apiJson<WeatherSnapshot | null>(
    `/api/weather/current?lat=${latitude}&lon=${longitude}`
  );
  if (!snap) throw new Error("No weather available");
  return snap;
}

// Historical conditions for a past date/time at a coordinate. The server matches
// on the local wall-clock date + hour the user entered, so we send those parts.
export async function fetchWeatherAt(
  latitude: number,
  longitude: number,
  when: Date
): Promise<WeatherSnapshot | null> {
  try {
    return await apiJson<WeatherSnapshot | null>(
      `/api/weather/at?lat=${latitude}&lon=${longitude}&date=${localDateKey(when)}&hour=${when.getHours()}`
    );
  } catch {
    return null;
  }
}

// Daily mean temperature + precipitation for a whole year at one location, used
// to backfill the calendar. Cached per location+year for the session.
export interface DailyWeather {
  meanTempC: Map<string, number>; // temperature_2m_mean (°C)
  precipMm: Map<string, number>; // precipitation_sum (mm)
}

const dailyWeatherCache = new Map<string, DailyWeather>();

export async function fetchDailyWeather(latitude: number, longitude: number, year: number): Promise<DailyWeather> {
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)},${year}`;
  const cached = dailyWeatherCache.get(cacheKey);
  if (cached) return cached;

  try {
    const data = await apiJson<{ meanTempC: Record<string, number>; precipMm: Record<string, number> }>(
      `/api/weather/daily?lat=${latitude}&lon=${longitude}&year=${year}`
    );
    const result: DailyWeather = {
      meanTempC: new Map(Object.entries(data.meanTempC ?? {})),
      precipMm: new Map(Object.entries(data.precipMm ?? {})),
    };
    if (result.meanTempC.size > 0 || result.precipMm.size > 0) dailyWeatherCache.set(cacheKey, result);
    return result;
  } catch {
    return { meanTempC: new Map(), precipMm: new Map() };
  }
}

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function formatTemperature(celsius: number | null, unit: "C" | "F"): string {
  if (celsius === null) return "—";
  const value = unit === "F" ? celsiusToFahrenheit(celsius) : celsius;
  return `${Math.round(value)}°${unit}`;
}
