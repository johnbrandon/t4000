export const ACTIVITY_TYPES = [
  "Run",
  "Walk",
  "Ride",
  "Strength",
  "Yoga",
  "Swim",
  "Hike",
  "Work",
  "Meeting",
  "Meal",
  "Social",
  "Travel",
  "Rest",
  "Other",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface CheckIn {
  id: string;
  createdAt: string; // ISO 8601
  latitude: number;
  longitude: number;
  placeLabel: string | null;
  temperatureC: number | null;
  dewpointC: number | null;
  weatherCondition: string | null;
  weatherCode: number | null;
  durationMinutes: number;
  activityType: ActivityType;
  purpose: string;
  participants: string[];
}

export type NewCheckIn = Omit<CheckIn, "id" | "createdAt">;

export interface Settings {
  birthDate: string | null; // YYYY-MM-DD
  lifeExpectancyWeeks: number;
  temperatureUnit: "C" | "F";
}

export const DEFAULT_SETTINGS: Settings = {
  birthDate: null,
  lifeExpectancyWeeks: 4000,
  temperatureUnit: "F",
};
