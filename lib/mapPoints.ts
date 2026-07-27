import { formatRelativeTime } from "./time";
import type { CheckIn } from "./types";

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  title: string;
  subtitle: string;
}

// `pointColor` is the current theme's marker color (concrete, since Leaflet and
// the native list draw it directly).
export function checkInsToPoints(checkIns: CheckIn[], pointColor: string): MapPoint[] {
  const points: MapPoint[] = [];
  for (const c of checkIns) {
    if (c.latitude == null || c.longitude == null) continue;
    const place = c.placeLabel ?? `${c.latitude.toFixed(3)}, ${c.longitude.toFixed(3)}`;
    points.push({
      id: c.id,
      latitude: c.latitude,
      longitude: c.longitude,
      color: pointColor,
      title: c.activityTypes.join(", "),
      subtitle: `${place} · ${formatRelativeTime(c.createdAt)}`,
    });
  }
  return points;
}
