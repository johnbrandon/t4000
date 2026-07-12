import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { activityColor, theme } from "../lib/theme";
import type { ActivityType } from "../lib/types";

const ICONS: Record<ActivityType, keyof typeof Ionicons.glyphMap> = {
  "Biz dev": "laptop",
  Buyer: "cart",
  Call: "call",
  Coffee: "cafe",
  Email: "mail",
  Landlord: "business",
  Other: "ellipsis-horizontal",
  Renter: "key",
  Seller: "pricetag",
  Showing: "home",
  Social: "people",
  Sphere: "share-social",
  Text: "chatbubble-ellipses",
  Travel: "airplane",
};

export function activityIconName(activity: ActivityType): keyof typeof Ionicons.glyphMap {
  return ICONS[activity] ?? "ellipse";
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
      <Ionicons name={ICONS[activity] ?? "ellipse"} size={size} color={color} />
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
