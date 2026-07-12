import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CheckInCard from "../../components/CheckInCard";
import Chip from "../../components/Chip";
import StatCard from "../../components/StatCard";
import { useCheckIns, useSettings } from "../../lib/hooks";
import { computeStats } from "../../lib/stats";
import { theme } from "../../lib/theme";
import { formatDuration } from "../../lib/time";
import type { CheckIn } from "../../lib/types";

const PAGE_SIZE = 20;

const SORTS = {
  newest: { label: "Newest", compare: (a: CheckIn, b: CheckIn) => b.createdAt.localeCompare(a.createdAt) },
  oldest: { label: "Oldest", compare: (a: CheckIn, b: CheckIn) => a.createdAt.localeCompare(b.createdAt) },
  longest: { label: "Longest", compare: (a: CheckIn, b: CheckIn) => b.durationMinutes - a.durationMinutes },
  shortest: { label: "Shortest", compare: (a: CheckIn, b: CheckIn) => a.durationMinutes - b.durationMinutes },
} as const;
type SortKey = keyof typeof SORTS;

export default function FeedScreen() {
  const { checkIns, loading, refresh } = useCheckIns();
  const { settings } = useSettings();
  const router = useRouter();
  const stats = useMemo(() => computeStats(checkIns), [checkIns]);

  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const sorted = useMemo(() => [...checkIns].sort(SORTS[sortKey].compare), [checkIns, sortKey]);

  // Infinite scroll: reveal the feed in pages as the user reaches the end.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [checkIns.length === 0, sortKey]);

  const visible = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = visibleCount < sorted.length;

  function loadMore() {
    if (hasMore) setVisibleCount((c) => c + PAGE_SIZE);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.color.accent} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Check In</Text>
              <Pressable style={styles.newButton} onPress={() => router.push("/check-in")}>
                <MaterialCommunityIcons name="plus" size={22} color={theme.color.background} />
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              <StatCard label="This week" value={String(stats.weekCount)} accent={theme.color.accent} />
              <StatCard label="Week time" value={formatDuration(stats.weekMinutes)} accent={theme.color.accentBlue} />
            </View>
            {checkIns.length > 1 ? (
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort</Text>
                {(Object.keys(SORTS) as SortKey[]).map((key) => (
                  <Chip
                    key={key}
                    label={SORTS[key].label}
                    selected={sortKey === key}
                    onPress={() => setSortKey(key)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <CheckInCard
            checkIn={item}
            temperatureUnit={settings.temperatureUnit}
            onPress={() => router.push({ pathname: "/check-in", params: { id: item.id } })}
          />
        )}
        ListFooterComponent={
          hasMore ? <ActivityIndicator style={styles.footer} color={theme.color.textMuted} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="pulse" size={40} color={theme.color.textMuted} />
              <Text style={styles.emptyTitle}>No check-ins yet</Text>
              <Text style={styles.emptyBody}>Log your first interaction to start filling in your year.</Text>
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
    marginBottom: theme.spacing(4),
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: theme.spacing(3),
  },
  sortLabel: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  footer: {
    marginVertical: theme.spacing(4),
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
