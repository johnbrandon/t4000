import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView from "../../components/MapView";
import { useCheckIns } from "../../lib/hooks";
import { checkInsToPoints } from "../../lib/mapPoints";
import { theme } from "../../lib/theme";

export default function MapScreen() {
  const { checkIns } = useCheckIns();
  const points = useMemo(() => checkInsToPoints(checkIns), [checkIns]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.subtitle}>
          {points.length} check-in{points.length === 1 ? "" : "s"} with a location.
        </Text>
      </View>
      <View style={styles.mapWrap}>
        {points.length > 0 ? (
          <MapView points={points} />
        ) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="map-marker-outline" size={40} color={theme.color.textMuted} />
            <Text style={styles.emptyTitle}>No located check-ins yet</Text>
            <Text style={styles.emptyBody}>
              Check in with location enabled — or add a past check-in with coordinates — and pins will
              appear here.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  header: {
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(3),
  },
  title: {
    color: theme.color.textPrimary,
    fontFamily: theme.font.display,
    fontSize: theme.font.hero,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  subtitle: {
    color: theme.color.textSecondary,
    fontSize: theme.font.body,
    marginTop: theme.spacing(1),
  },
  mapWrap: {
    flex: 1,
    overflow: "hidden",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing(8),
  },
  emptyTitle: {
    color: theme.color.textPrimary,
    fontSize: theme.font.subtitle,
    fontWeight: "700",
    marginTop: theme.spacing(3),
  },
  emptyBody: {
    color: theme.color.textMuted,
    fontSize: theme.font.body,
    textAlign: "center",
    marginTop: theme.spacing(2),
  },
});
