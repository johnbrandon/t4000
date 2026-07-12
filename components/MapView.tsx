import { Ionicons } from "@expo/vector-icons";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { MapPoint } from "../lib/mapPoints";
import { theme } from "../lib/theme";

// Native fallback: the interactive map is web-only (it uses Leaflet). On a
// device we list the located check-ins so the data is still accessible.
export default function MapView({ points }: { points: MapPoint[] }) {
  return (
    <View style={styles.container}>
      <View style={styles.note}>
        <Ionicons name="map-outline" size={18} color={theme.color.textMuted} />
        <Text style={styles.noteText}>The interactive map is available in the web app.</Text>
      </View>
      <FlatList
        data={points}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: theme.spacing(3),
  },
  noteText: { color: theme.color.textMuted, fontSize: theme.font.caption },
  list: { paddingHorizontal: theme.spacing(4) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(3),
    paddingVertical: theme.spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { color: theme.color.textPrimary, fontSize: theme.font.body, fontWeight: "700" },
  subtitle: { color: theme.color.textSecondary, fontSize: theme.font.caption, marginTop: 2 },
});
