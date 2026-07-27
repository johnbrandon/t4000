// Daily 10-year Treasury constant-maturity yield (FRED series DGS10), fetched
// keyless as CSV. Values are percentages; missing days come back as "." and are
// skipped. Results are cached per year for the session.
const cache = new Map<number, Map<string, number>>();

function parseFredCsv(text: string): Map<string, number> {
  const map = new Map<string, number>();
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const [date, value] = lines[i].split(",");
    if (!date) continue;
    const n = parseFloat(value);
    if (Number.isFinite(n)) map.set(date.trim(), n);
  }
  return map;
}

async function fetchCsv(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTreasuryYields(year: number): Promise<Map<string, number>> {
  const cached = cache.get(year);
  if (cached) return cached;

  const fredUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=${year}-01-01&coed=${year}-12-31`;

  // Try FRED directly first (works on native and if CORS allows). On the web,
  // FRED may not send CORS headers, so fall back to a CORS proxy.
  let text = await fetchCsv(fredUrl);
  if (!text || !text.includes("DGS10")) {
    text = await fetchCsv(`https://corsproxy.io/?url=${encodeURIComponent(fredUrl)}`);
  }
  if (!text) return new Map();

  const map = parseFredCsv(text);
  if (map.size > 0) cache.set(year, map);
  return map;
}
