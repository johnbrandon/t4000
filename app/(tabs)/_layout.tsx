import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemePalette } from "../../lib/ThemeContext";

export default function TabsLayout() {
  const palette = useThemePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontWeight: "500",
          letterSpacing: 0.1,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="pulse" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="check-in"
        options={{
          title: "Check In",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="plus-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="year"
        options={{
          title: "This Year",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
