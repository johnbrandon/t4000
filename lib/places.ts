// Nearby venues from Foursquare, via our authenticated API (the key lives on the
// server). Used by the check-in screen to name the place you're at.
import { apiJson } from "./api";
import type { ActivityType } from "./types";

export interface Place {
  fsqId: string;
  name: string;
  category: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
}

export async function getPlacesStatus(): Promise<{ configured: boolean }> {
  try {
    return await apiJson<{ configured: boolean }>("/api/places/status");
  } catch {
    return { configured: false };
  }
}

export async function searchNearbyPlaces(
  latitude: number,
  longitude: number,
  query?: string
): Promise<Place[]> {
  const q = query?.trim() ? `&q=${encodeURIComponent(query.trim())}` : "";
  return apiJson<Place[]>(`/api/places/search?lat=${latitude}&lon=${longitude}${q}`);
}

// Human-friendly distance (US units, since the app defaults to °F).
export function formatDistance(meters: number | null): string {
  if (meters === null) return "";
  const feet = meters * 3.28084;
  if (feet < 1000) return `${Math.round(feet / 10) * 10} ft`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

// Best-effort guess at an activity tag from a venue's category, used only to
// pre-select when the user hasn't chosen one yet (never to override a choice).
export function activityForCategory(category: string | null): ActivityType | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (/coffee|caf[eé]|tea house|espresso/.test(c)) return "Coffee";
  if (/office|coworking|corporate|headquarter|business center/.test(c)) return "Meeting";
  if (/restaurant|bar|pub|brewery|winery|diner|bistro|food|café|cafe|lounge|nightlife/.test(c)) return "Social";
  return null;
}
