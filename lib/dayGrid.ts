import { activityColor } from "./theme";
import type { CheckIn } from "./types";

export interface DaySummary {
  date: string; // YYYY-MM-DD (local)
  count: number;
  totalMinutes: number;
  dominantActivity: string;
  color: string;
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
    for (const entry of entries) {
      counts.set(entry.activityType, (counts.get(entry.activityType) ?? 0) + 1);
      totalMinutes += entry.durationMinutes;
    }
    const dominantActivity = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    summaries.set(date, {
      date,
      count: entries.length,
      totalMinutes,
      dominantActivity,
      color: activityColor(dominantActivity),
      checkIns: entries,
    });
  }
  return summaries;
}

export interface DayCell {
  date: string;
  day: Date;
  isFuture: boolean;
}

// Lay the year out as calendar columns (weeks) of 7 weekday rows (Sun..Sat),
// GitHub-contributions style. Leading/trailing slots outside the year are null.
export function buildYearColumns(year: number, now: Date = new Date()): (DayCell | null)[][] {
  const firstDay = new Date(year, 0, 1);
  const lastDay = new Date(year, 11, 31);
  const columns: (DayCell | null)[][] = [];

  let current = new Date(firstDay);
  // Back up to the Sunday that starts the first week.
  current.setDate(current.getDate() - current.getDay());

  const todayKey = localDayKey(now);
  while (current <= lastDay || current.getDay() !== 0) {
    const column: (DayCell | null)[] = [];
    for (let row = 0; row < 7; row++) {
      if (current < firstDay || current > lastDay) {
        column.push(null);
      } else {
        const key = localDayKey(current);
        column.push({
          date: key,
          day: new Date(current),
          isFuture: key > todayKey,
        });
      }
      current.setDate(current.getDate() + 1);
    }
    columns.push(column);
    if (current > lastDay && current.getDay() === 0) break;
  }
  return columns;
}

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
