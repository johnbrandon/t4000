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

// Keyless reverse geocoding via BigDataCloud's free client endpoint. Works
// the same way on native and web, unlike expo-location's reverseGeocodeAsync
// which has no web implementation.
export async function reverseGeocode(coords: Coordinates): Promise<string | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    const parts = [data.locality, data.principalSubdivisionCode || data.principalSubdivision].filter(Boolean);
    return parts.length ? parts.join(", ") : data.countryName ?? null;
  } catch {
    return null;
  }
}
