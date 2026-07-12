import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { activityColor, theme } from "../lib/theme";
import type { ActivityType } from "../lib/types";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const ICONS: Record<ActivityType, IconName> = {
  "Biz dev": "laptop",
  Buyer: "cart",
  Coffee: "coffee",
  Landlord: "office-building",
  Meeting: "account-group",
  Other: "dots-horizontal",
  Renter: "key-variant",
  Seller: "tag",
  Social: "account-multiple",
  Sphere: "share-variant",
  Subway: "subway-variant",
};

export function activityIconName(activity: ActivityType): IconName {
  return ICONS[activity] ?? "circle-medium";
}

export default function ActivityIcon({ activity, size = 22 }: { activity: ActivityType; size?: number }) {
  const color = activityColor(activity);
  return (
    <View
      style={[
        styles.badge,
        {
          width: size * 1.9,
          height: size * 1.9,
          borderRadius: size,
          backgroundColor: color + "26",
        },
      ]}
    >
      <MaterialCommunityIcons name={ICONS[activity] ?? "circle-medium"} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.color.border,
  },
});
