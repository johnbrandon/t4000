import * as Location from "expo-location";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export class LocationPermissionError extends Error {
  constructor() {
    super("Location permission was not granted.");
    this.name = "LocationPermissionError";
  }
}

export async function getCurrentCoordinates(): Promise<Coordinates> {
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
