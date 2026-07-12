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

// Common US street-type abbreviations (USPS-style).
const STREET_ABBR: Record<string, string> = {
  street: "St",
  avenue: "Ave",
  boulevard: "Blvd",
  road: "Rd",
  drive: "Dr",
  lane: "Ln",
  court: "Ct",
  place: "Pl",
  terrace: "Ter",
  circle: "Cir",
  parkway: "Pkwy",
  highway: "Hwy",
  square: "Sq",
  trail: "Trl",
  way: "Way",
  alley: "Aly",
  plaza: "Plz",
  crescent: "Cres",
  close: "Cl",
};

const US_STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

function abbreviateStreet(road: string): string {
  return road
    .split(" ")
    .map((word) => {
      const key = word.toLowerCase().replace(/[.,]/g, "");
      return STREET_ABBR[key] ?? word;
    })
    .join(" ");
}

function abbreviateState(name: string | undefined, isoCode: string | undefined): string | null {
  // Prefer Nominatim's ISO code (e.g. "US-CO" -> "CO"); fall back to the name map.
  if (isoCode && /-[A-Z]{2}$/.test(isoCode)) return isoCode.slice(-2);
  if (name) {
    const abbr = US_STATE_ABBR[name.toLowerCase()];
    if (abbr) return abbr;
  }
  return name ?? null;
}

// Keyless reverse geocoding to a street-level address via OpenStreetMap's
// Nominatim service. Composes a concise, abbreviated US-style address:
// "123 Main St, Springfield, IL 62701".
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

    const road = a.road ? abbreviateStreet(a.road) : "";
    const street = [a.house_number, road].filter(Boolean).join(" ");
    const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.county;
    const state = abbreviateState(a.state, a["ISO3166-2-lvl4"]);
    const zip = typeof a.postcode === "string" ? (a.postcode.match(/\d{5}/)?.[0] ?? null) : null;

    const cityState = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const parts = [street, cityState].filter(Boolean);
    if (parts.length) return parts.join(", ");
    return typeof data.display_name === "string" ? data.display_name : null;
  } catch {
    return null;
  }
}
