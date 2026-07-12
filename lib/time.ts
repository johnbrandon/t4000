const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function parseBirthDate(birthDate: string): Date {
  const [year, month, day] = birthDate.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

// 0-based index of the week `date` falls into, counted from `birthDate`.
export function weekIndexForDate(birthDate: Date, date: Date): number {
  const diffMs = date.getTime() - birthDate.getTime();
  return Math.floor(diffMs / MS_PER_WEEK);
}

export function weeksLived(birthDate: Date, now: Date = new Date()): number {
  return Math.max(0, weekIndexForDate(birthDate, now));
}

export function ageYears(birthDate: Date, now: Date = new Date()): number {
  return (now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function isSameWeek(a: Date, b: Date): boolean {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime();
}
