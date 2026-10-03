import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getICloudStatus, syncICloudContacts } from "../../lib/db";
import { useContacts } from "../../lib/hooks";
import { theme } from "../../lib/theme";
import type { Contact } from "../../lib/types";

// First letters of the first two name words, for the avatar disc.
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const second = words.length > 1 ? words[words.length - 1][0] ?? "" : "";
  return (first + second).toUpperCase();
}

function subtitleFor(c: Contact): string {
  return c.emails[0] ?? c.phones[0] ?? c.organization ?? "";
}

function matches(c: Contact, q: string): boolean {
  const hay = [c.fullName, c.organization ?? "", ...c.emails, ...c.phones].join(" ").toLowerCase();
  return hay.includes(q);
}

export default function ContactsScreen() {
  const { contacts, loading, refresh } = useContacts();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    getICloudStatus().then((s) => setConfigured(s.configured));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? contacts.filter((c) => matches(c, q)) : contacts;
  }, [contacts, query]);

  async function onSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncICloudContacts();
      refresh();
      const parts = [`${result.imported} imported`];
      if (result.pruned > 0) parts.push(`${result.pruned} removed`);
      setSyncMsg(`Synced from iCloud: ${parts.join(", ")}.`);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed. Check the iCloud credentials on the server.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.color.accent} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Contacts</Text>
              {configured ? (
                <Pressable style={[styles.syncButton, syncing && styles.syncButtonBusy]} onPress={onSync} disabled={syncing}>
                  {syncing ? (
                    <ActivityIndicator size="small" color={theme.color.background} />
                  ) : (
                    <MaterialCommunityIcons name="sync" size={18} color={theme.color.background} />
                  )}
                  <Text style={styles.syncLabel}>{syncing ? "Syncing" : "Sync iCloud"}</Text>
                </Pressable>
              ) : null}
            </View>

            {configured === false ? (
              <Text style={styles.note}>
                iCloud isn't configured on the server yet. Add ICLOUD_USERNAME and ICLOUD_APP_PASSWORD to enable import.
              </Text>
            ) : null}
            {syncMsg ? <Text style={styles.note}>{syncMsg}</Text> : null}

            {contacts.length > 0 ? (
              <View style={styles.searchWrap}>
                <MaterialCommunityIcons name="magnify" size={18} color={theme.color.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search name, email, phone"
                  placeholderTextColor={theme.color.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {query ? (
                  <Pressable onPress={() => setQuery("")} hitSlop={8}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={theme.color.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push({ pathname: "/contact/[id]", params: { id: item.id } })}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(item.fullName)}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.fullName}
              </Text>
              {subtitleFor(item) ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  {subtitleFor(item)}
                </Text>
              ) : null}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.color.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-multiple-outline" size={40} color={theme.color.textMuted} />
              <Text style={styles.emptyTitle}>{query ? "No matches" : "No contacts yet"}</Text>
              <Text style={styles.emptyBody}>
                {query
                  ? "Try a different name, email, or phone number."
                  : configured
                    ? "Tap Sync iCloud to import your contacts."
                    : "Configure iCloud on the server to import your contacts."}
              </Text>
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
    marginBottom: theme.spacing(3),
  },
  title: {
    color: theme.color.textPrimary,
    fontSize: theme.font.hero,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    backgroundColor: theme.color.accent,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radius.pill,
  },
  syncButtonBusy: {
    opacity: 0.7,
  },
  syncLabel: {
    color: theme.color.background,
    fontSize: theme.font.caption,
    fontWeight: "600",
  },
  note: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    marginBottom: theme.spacing(3),
    lineHeight: 17,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(2),
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  searchInput: {
    flex: 1,
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
    // RNW puts a focus outline on inputs; drop it for a flat look.
    outlineStyle: "none" as unknown as undefined,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(3),
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.color.accent,
    fontSize: theme.font.body,
    fontWeight: "700",
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
    fontWeight: "600",
  },
  rowSub: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    marginTop: 2,
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
