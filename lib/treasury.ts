// Daily 10-year Treasury yield (FRED series DGS10). Fetching now happens on the
// server (server/src/market.ts) and is reached through our authenticated API, so
// there's no CORS workaround or third-party proxy. Same exported surface as before:
// a date -> percent map, cached per year for the session.
import { apiJson } from "./api";

const cache = new Map<number, Map<string, number>>();

export async function fetchTreasuryYields(year: number): Promise<Map<string, number>> {
  const cached = cache.get(year);
  if (cached) return cached;

  try {
    const data = await apiJson<Record<string, number>>(`/api/treasury?year=${year}`);
    const map = new Map(Object.entries(data ?? {}));
    if (map.size > 0) cache.set(year, map);
    return map;
  } catch {
    return new Map();
  }
}
