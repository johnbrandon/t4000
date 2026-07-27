import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { theme } from "../lib/theme";
import type { ActivityType } from "../lib/types";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const ICONS: Record<ActivityType, IconName> = {
  "Biz dev": "laptop",
  Buyer: "cart",
  Coffee: "coffee",
  Landlord: "office-building",
  Meeting: "account-group",
  Other: "dots-horizontal",
  Seller: "tag",
  Social: "account-multiple",
  Sphere: "share-variant",
  Travel: "train-variant",
};

export function activityIconName(activity: ActivityType): IconName {
  return ICONS[activity] ?? "circle-medium";
}

export default function ActivityIcon({ activity, size = 22 }: { activity: ActivityType; size?: number }) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size * 1.9,
          height: size * 1.9,
          borderRadius: size,
          backgroundColor: theme.color.accentSoft,
        },
      ]}
    >
      <MaterialCommunityIcons name={ICONS[activity] ?? "circle-medium"} size={size} color={theme.color.accent} />
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
