import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CheckInCard from "../../components/CheckInCard";
import { useCheckIns, useSettings } from "../../lib/hooks";
import { theme } from "../../lib/theme";

const PAGE_SIZE = 20;

export default function FeedScreen() {
  const { checkIns, loading, refresh } = useCheckIns();
  const { settings } = useSettings();
  const router = useRouter();

  // Newest first. (The API already returns this order; sort defensively.)
  const ordered = useMemo(
    () => [...checkIns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [checkIns]
  );

  // Infinite scroll: reveal the feed in pages as the user reaches the end.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [checkIns.length === 0]);

  const visible = useMemo(() => ordered.slice(0, visibleCount), [ordered, visibleCount]);
  const hasMore = visibleCount < ordered.length;

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
          <View style={styles.header}>
            <Text style={styles.title}>Check In</Text>
            <Pressable style={styles.newButton} onPress={() => router.push("/check-in")}>
              <MaterialCommunityIcons name="plus" size={22} color={theme.color.background} />
            </Pressable>
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
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.accent,
    alignItems: "center",
    justifyContent: "center",
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
