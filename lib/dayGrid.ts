import type { CheckIn } from "./types";

export interface DaySummary {
  date: string; // YYYY-MM-DD (local)
  count: number;
  interactionCount: number; // check-ins tagged Buyer or Seller (drives the grid)
  totalMinutes: number;
  dominantActivity: string;
  avgTempC: number | null; // average recorded temperature that day, if any
  checkIns: CheckIn[];
}

// Local YYYY-MM-DD key (not UTC) so a check-in lands on the calendar day it
// felt like to the user, regardless of timezone.
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function summarizeByDay(checkIns: CheckIn[], year: number): Map<string, DaySummary> {
  const byDay = new Map<string, CheckIn[]>();
  for (const checkIn of checkIns) {
    const date = new Date(checkIn.createdAt);
    if (date.getFullYear() !== year) continue;
    const key = localDayKey(date);
    const bucket = byDay.get(key) ?? [];
    bucket.push(checkIn);
    byDay.set(key, bucket);
  }

  const summaries = new Map<string, DaySummary>();
  for (const [date, entries] of byDay) {
    const counts = new Map<string, number>();
    let totalMinutes = 0;
    let tempSum = 0;
    let tempCount = 0;
    let interactionCount = 0;
    for (const entry of entries) {
      for (const activity of entry.activityTypes) {
        counts.set(activity, (counts.get(activity) ?? 0) + 1);
      }
      // The grid only logs a day's "interactions" for buyer/seller check-ins.
      if (entry.activityTypes.includes("Buyer") || entry.activityTypes.includes("Seller")) {
        interactionCount += 1;
      }
      totalMinutes += entry.durationMinutes;
      if (typeof entry.temperatureC === "number") {
        tempSum += entry.temperatureC;
        tempCount += 1;
      }
    }
    const dominantActivity = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    summaries.set(date, {
      date,
      count: entries.length,
      interactionCount,
      totalMinutes,
      dominantActivity,
      avgTempC: tempCount > 0 ? tempSum / tempCount : null,
      checkIns: entries,
    });
  }
  return summaries;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${`${month + 1}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// An ordered run of day keys with a centered month label for each month, used to
// drive the daily charts across an arbitrary window (not just a calendar year).
export interface DayWindow {
  keys: string[]; // ordered YYYY-MM-DD (local)
  monthStarts: { label: string; index: number }[]; // label centered over its month's run
}

// The trailing ~12 months: from the 1st of the month 11 months ago through today.
export function trailingYearWindow(end: Date = new Date()): DayWindow {
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  const keys: string[] = [];
  const cursor = new Date(start);
  // Compare on local date only, so the final day (today) is included.
  const endKey = localDayKey(end);
  while (localDayKey(cursor) <= endKey) {
    keys.push(localDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const monthStarts: { label: string; index: number }[] = [];
  let runStart = 0;
  for (let i = 1; i <= keys.length; i++) {
    const prevMonth = Number(keys[i - 1].slice(5, 7)) - 1;
    const curMonth = i < keys.length ? Number(keys[i].slice(5, 7)) - 1 : -1;
    if (i === keys.length || curMonth !== prevMonth) {
      monthStarts.push({ label: MONTH_INITIALS[prevMonth], index: (runStart + i - 1) / 2 });
      runStart = i;
    }
  }
  return { keys, monthStarts };
}
