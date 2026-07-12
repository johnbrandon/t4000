import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CheckInCard from "../../components/CheckInCard";
import StatCard from "../../components/StatCard";
import { useCheckIns, useSettings } from "../../lib/hooks";
import { computeStats } from "../../lib/stats";
import { theme } from "../../lib/theme";
import { formatDuration } from "../../lib/time";

export default function FeedScreen() {
  const { checkIns, loading, refresh } = useCheckIns();
  const { settings } = useSettings();
  const router = useRouter();
  const stats = useMemo(() => computeStats(checkIns), [checkIns]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={checkIns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.color.accent} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Check In</Text>
              <Pressable style={styles.newButton} onPress={() => router.push("/check-in")}>
                <Ionicons name="add" size={22} color={theme.color.background} />
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              <StatCard label="This week" value={String(stats.weekCount)} accent={theme.color.accent} />
              <StatCard label="Week time" value={formatDuration(stats.weekMinutes)} accent={theme.color.accentBlue} />
              <StatCard label="Streak" value={`${stats.currentStreakDays}d`} accent={theme.color.accentAlt} />
            </View>
          </View>
        }
        renderItem={({ item }) => <CheckInCard checkIn={item} temperatureUnit={settings.temperatureUnit} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="pulse-outline" size={40} color={theme.color.textMuted} />
              <Text style={styles.emptyTitle}>No check-ins yet</Text>
              <Text style={styles.emptyBody}>Log your first activity to start filling in your weeks.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  listContent: {
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(10),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(4),
  },
  title: {
    color: theme.color.textPrimary,
    fontSize: theme.font.hero,
    fontWeight: "800",
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing(3),
    marginBottom: theme.spacing(5),
  },
  empty: {
    alignItems: "center",
    marginTop: theme.spacing(20),
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
