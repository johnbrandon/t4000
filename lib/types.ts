export const ACTIVITY_TYPES = [
  "Biz dev",
  "Buyer",
  "Coffee",
  "Landlord",
  "Meeting",
  "Other",
  "Seller",
  "Social",
  "Sphere",
  "Travel",
] as const;

// Interaction quality: a 5-step scale from 1 (worst) to 5 (best), 3 = neutral.
export const QUALITY_MIN = 1;
export const QUALITY_MAX = 5;
export const QUALITY_NEUTRAL = 3;

// Ordered low → high so the check-in picker reads 1 to 5 left to right.
export const QUALITY_LEVELS = [
  { value: 1, label: "Bad" },
  { value: 2, label: "Poor" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// Activities offered when creating a check-in. "Travel" stays in ACTIVITY_TYPES
// (and keeps its icon) so existing travel check-ins still display, but it's no
// longer offered as an option for new check-ins.
export const SELECTABLE_ACTIVITIES = ACTIVITY_TYPES.filter((a) => a !== "Travel");

export interface CheckIn {
  id: string;
  createdAt: string; // ISO 8601
  latitude: number | null;
  longitude: number | null;
  placeLabel: string | null;
  temperatureC: number | null;
  dewpointC: number | null;
  weatherCondition: string | null;
  weatherCode: number | null;
  durationMinutes: number;
  activityTypes: ActivityType[];
  quality: number; // -2..+2 interaction quality
  purpose: string;
  participants: string[];
}

export type NewCheckIn = Omit<CheckIn, "id" | "createdAt">;

export interface Contact {
  id: string;
  icloudUid: string | null;
  fullName: string;
  emails: string[];
  phones: string[];
  addresses: string[];
  organization: string | null;
  source: string; // "icloud" | "manual"
  updatedAt: string; // ISO 8601
}

export interface Settings {
  temperatureUnit: "C" | "F";
  themeName: "light" | "night";
}

export const DEFAULT_SETTINGS: Settings = {
  temperatureUnit: "F",
  themeName: "light",
};
