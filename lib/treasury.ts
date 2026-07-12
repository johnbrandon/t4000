// Daily 10-year Treasury constant-maturity yield (FRED series DGS10), fetched
// keyless as CSV. Values are percentages; missing days come back as "." and are
// skipped. Results are cached per year for the session.
const cache = new Map<number, Map<string, number>>();

export async function fetchTreasuryYields(year: number): Promise<Map<string, number>> {
  const cached = cache.get(year);
  if (cached) return cached;

  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=${year}-01-01&coed=${year}-12-31`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return new Map();
    const text = await response.text();
    const map = new Map<string, number>();
    const lines = text.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const [date, value] = lines[i].split(",");
      if (!date) continue;
      const n = parseFloat(value);
      if (Number.isFinite(n)) map.set(date.trim(), n);
    }
    if (map.size > 0) cache.set(year, map);
    return map;
  } catch {
    return new Map();
  } finally {
    clearTimeout(timeout);
  }
}
