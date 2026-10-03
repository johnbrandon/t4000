// Server-side proxy for Foursquare Places "Search", so the browser never holds
// the API key and we can cache. Uses the current Places API
// (places-api.foursquare.com, Bearer auth + a dated version header); the version
// is env-overridable so it can be bumped without a code change.
//
//   FOURSQUARE_API_KEY      = a Places API key from foursquare.com/developers
//   FOURSQUARE_API_VERSION  = optional, defaults to a known-good date
const SEARCH_URL = "https://places-api.foursquare.com/places/search";
const API_VERSION = process.env.FOURSQUARE_API_VERSION || "2025-06-17";
const KEY = process.env.FOURSQUARE_API_KEY;

export function placesConfigured(): boolean {
  return Boolean(KEY);
}

export interface Place {
  fsqId: string;
  name: string;
  category: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
}

interface Entry {
  value: Place[];
  expires: number;
}
const cache = new Map<string, Entry>();
const TTL = 5 * 60 * 1000;

function firstCategory(r: Record<string, unknown>): string | null {
  const cats = r.categories;
  if (Array.isArray(cats) && cats.length > 0 && cats[0] && typeof cats[0] === "object") {
    const c = cats[0] as Record<string, unknown>;
    const name = c.short_name ?? c.name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Map a Foursquare result defensively, accepting both the new API shape
// (fsq_place_id, top-level latitude/longitude) and the legacy one (fsq_id,
// geocodes.main) in case of version drift.
function toPlace(r: Record<string, unknown>): Place {
  const loc = (r.location ?? {}) as Record<string, unknown>;
  const geo = ((r.geocodes as Record<string, unknown>)?.main ?? {}) as Record<string, unknown>;
  const address =
    (typeof loc.formatted_address === "string" && loc.formatted_address) ||
    (typeof loc.address === "string" && loc.address) ||
    null;
  return {
    fsqId: String(r.fsq_place_id ?? r.fsq_id ?? ""),
    name: typeof r.name === "string" ? r.name : "",
    category: firstCategory(r),
    address,
    latitude: asNumber(r.latitude) ?? asNumber(geo.latitude),
    longitude: asNumber(r.longitude) ?? asNumber(geo.longitude),
    distanceM: asNumber(r.distance),
  };
}

export async function searchNearby(
  lat: number,
  lon: number,
  query: string | undefined,
  limit = 10
): Promise<Place[]> {
  if (!KEY) throw new Error("Foursquare is not configured on the server");

  const q = (query ?? "").trim();
  const capped = Math.min(Math.max(limit, 1), 20);
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}|${q.toLowerCase()}|${capped}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value;

  // NB: we deliberately do NOT send a `fields` selector. Restricting fields can
  // silently drop latitude/longitude from the response (they're returned by
  // default), which would leave venue pins stuck at the device location.
  const params = new URLSearchParams({
    ll: `${lat},${lon}`,
    radius: "2000",
    limit: String(capped),
    sort: q ? "RELEVANCE" : "DISTANCE",
  });
  if (q) params.set("query", q);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let data: unknown;
  try {
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${KEY}`,
        "X-Places-Api-Version": API_VERSION,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Foursquare search failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
    }
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const results = (data as Record<string, unknown>)?.results;
  const places = (Array.isArray(results) ? results : [])
    .map((r) => toPlace(r as Record<string, unknown>))
    .filter((p) => p.fsqId && p.name);

  if (places.length > 0) cache.set(cacheKey, { value: places, expires: Date.now() + TTL });
  return places;
}
