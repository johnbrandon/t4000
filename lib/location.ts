import * as Location from "expo-location";
import { Platform } from "react-native";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export class LocationPermissionError extends Error {
  constructor(message = "Location permission was denied. Enable it in your browser or system settings to record where a check-in happened.") {
    super(message);
    this.name = "LocationPermissionError";
  }
}

export class LocationUnavailableError extends Error {
  constructor(message = "Couldn't determine your location. Try again in a moment.") {
    super(message);
    this.name = "LocationUnavailableError";
  }
}

// On web we call the browser Geolocation API directly. expo-location's web
// shim is thin and its permission handling doesn't reliably surface the
// browser prompt, whereas navigator.geolocation.getCurrentPosition always
// triggers it and gives precise error codes.
function getWebCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new LocationUnavailableError("This browser doesn't support geolocation."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) reject(new LocationPermissionError());
        else reject(new LocationUnavailableError());
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  });
}

async function getNativeCoordinates(): Promise<Coordinates> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new LocationPermissionError();
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

export function getCurrentCoordinates(): Promise<Coordinates> {
  return Platform.OS === "web" ? getWebCoordinates() : getNativeCoordinates();
}

// Keyless reverse geocoding to a street-level address via OpenStreetMap's
// Nominatim service. Composes a concise address (house number + street, city,
// state) and falls back to Nominatim's full display_name.
export async function reverseGeocode(coords: Coordinates): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=jsonv2&addressdetails=1&zoom=18`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    const a = data.address ?? {};

    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.county;
    const region = a.state || a.region;
    const parts = [street, city, region].filter(Boolean);
    if (parts.length) return parts.join(", ");
    return typeof data.display_name === "string" ? data.display_name : null;
  } catch {
    return null;
  }
}
