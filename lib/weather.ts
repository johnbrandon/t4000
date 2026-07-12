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

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function formatTemperature(celsius: number | null, unit: "C" | "F"): string {
  if (celsius === null) return "—";
  const value = unit === "F" ? celsiusToFahrenheit(celsius) : celsius;
  return `${Math.round(value)}°${unit}`;
}
