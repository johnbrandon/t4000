import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getContact } from "../../lib/db";
import { theme } from "../../lib/theme";
import type { Contact } from "../../lib/types";

// Strip spaces/punctuation so tel: links dial cleanly.
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

function open(url: string) {
  Linking.openURL(url).catch(() => {});
}

interface FieldProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
  onPress?: () => void;
}

function Field({ icon, label, value, onPress }: FieldProps) {
  const body = (
    <View style={styles.field}>
      <MaterialCommunityIcons name={icon} size={20} color={theme.color.textMuted} style={styles.fieldIcon} />
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, onPress && styles.fieldValueLink]}>{value}</Text>
      </View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getContact(String(id))
      .then((c) => active && setContact(c))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const name = contact?.fullName ?? "";
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={theme.color.textPrimary} />
          <Text style={styles.backText}>Contacts</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={theme.color.accent} />
      ) : !contact ? (
        <View style={styles.missing}>
          <Text style={styles.missingText}>Contact not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "?"}</Text>
            </View>
            <Text style={styles.name}>{contact.fullName}</Text>
            {contact.organization ? <Text style={styles.org}>{contact.organization}</Text> : null}
          </View>

          {contact.emails.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Email</Text>
              {contact.emails.map((email) => (
                <Field key={email} icon="email-outline" label="Email" value={email} onPress={() => open(`mailto:${email}`)} />
              ))}
            </View>
          ) : null}

          {contact.phones.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Phone</Text>
              {contact.phones.map((phone) => (
                <Field key={phone} icon="phone-outline" label="Phone" value={phone} onPress={() => open(telHref(phone))} />
              ))}
            </View>
          ) : null}

          {contact.addresses.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              {contact.addresses.map((addr) => (
                <Field key={addr} icon="map-marker-outline" label="Address" value={addr} />
              ))}
            </View>
          ) : null}

          {contact.source === "icloud" ? (
            <Text style={styles.footer}>Imported from iCloud · read-only</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  topBar: {
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(2),
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  backText: {
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
    fontWeight: "500",
  },
  loading: {
    marginTop: theme.spacing(20),
  },
  missing: {
    alignItems: "center",
    marginTop: theme.spacing(20),
  },
  missingText: {
    color: theme.color.textMuted,
    fontSize: theme.font.body,
  },
  content: {
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(10),
  },
  hero: {
    alignItems: "center",
    marginBottom: theme.spacing(6),
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.color.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing(3),
  },
  avatarText: {
    color: theme.color.accent,
    fontSize: theme.font.title,
    fontWeight: "700",
  },
  name: {
    color: theme.color.textPrimary,
    fontSize: theme.font.title,
    fontWeight: "700",
    textAlign: "center",
  },
  org: {
    color: theme.color.textMuted,
    fontSize: theme.font.body,
    marginTop: theme.spacing(1),
    textAlign: "center",
  },
  section: {
    marginBottom: theme.spacing(5),
  },
  sectionTitle: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: theme.spacing(2),
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  fieldIcon: {
    marginRight: theme.spacing(3),
  },
  fieldBody: {
    flex: 1,
  },
  fieldLabel: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    marginBottom: 2,
  },
  fieldValue: {
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
  },
  fieldValueLink: {
    color: theme.color.accentBlue,
  },
  footer: {
    color: theme.color.textMuted,
    fontSize: theme.font.caption,
    textAlign: "center",
    marginTop: theme.spacing(2),
  },
});
