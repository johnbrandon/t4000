import { activityColor } from "./theme";
import { weekIndexForDate } from "./time";
import type { CheckIn } from "./types";

export interface WeekSummary {
  weekIndex: number;
  count: number;
  totalMinutes: number;
  dominantActivity: string;
  color: string;
  checkIns: CheckIn[];
}

export function summarizeByWeek(checkIns: CheckIn[], birthDate: Date): Map<number, WeekSummary> {
  const byWeek = new Map<number, CheckIn[]>();

  for (const checkIn of checkIns) {
    const index = weekIndexForDate(birthDate, new Date(checkIn.createdAt));
    if (index < 0) continue;
    const bucket = byWeek.get(index) ?? [];
    bucket.push(checkIn);
    byWeek.set(index, bucket);
  }

  const summaries = new Map<number, WeekSummary>();
  for (const [weekIndex, entries] of byWeek) {
    const counts = new Map<string, number>();
    let totalMinutes = 0;
    for (const entry of entries) {
      counts.set(entry.activityType, (counts.get(entry.activityType) ?? 0) + 1);
      totalMinutes += entry.durationMinutes;
    }
    const dominantActivity = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    summaries.set(weekIndex, {
      weekIndex,
      count: entries.length,
      totalMinutes,
      dominantActivity,
      color: activityColor(dominantActivity),
      checkIns: entries,
    });
  }
  return summaries;
}
