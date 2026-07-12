import { startOfWeek } from "./time";
import type { CheckIn } from "./types";

export interface FeedStats {
  totalCheckIns: number;
  weekCount: number;
  weekMinutes: number;
  currentStreakDays: number;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeStats(checkIns: CheckIn[], now: Date = new Date()): FeedStats {
  const weekStart = startOfWeek(now);
  let weekCount = 0;
  let weekMinutes = 0;
  const daysWithCheckIn = new Set<string>();

  for (const checkIn of checkIns) {
    const date = new Date(checkIn.createdAt);
    daysWithCheckIn.add(dayKey(date));
    if (date >= weekStart) {
      weekCount += 1;
      weekMinutes += checkIn.durationMinutes;
    }
  }

  let streak = 0;
  const cursor = new Date(now);
  // A streak counts today only once it has a check-in; otherwise it starts
  // counting from yesterday so a still-open "today" doesn't zero it out.
  if (!daysWithCheckIn.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (daysWithCheckIn.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalCheckIns: checkIns.length,
    weekCount,
    weekMinutes,
    currentStreakDays: streak,
  };
}
