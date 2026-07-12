export const ACTIVITY_TYPES = [
  "Biz dev",
  "Buyer",
  "Call",
  "Email",
  "Landlord",
  "Other",
  "Renter",
  "Seller",
  "Showing",
  "Social",
  "Sphere",
  "Text",
  "Travel",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

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
  purpose: string;
  participants: string[];
}

export type NewCheckIn = Omit<CheckIn, "id" | "createdAt">;

export interface Settings {
  temperatureUnit: "C" | "F";
}

export const DEFAULT_SETTINGS: Settings = {
  temperatureUnit: "F",
};
