import { StyleSheet, Text, View } from "react-native";
import { theme } from "../lib/theme";

export default function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingVertical: theme.spacing(4),
    paddingHorizontal: theme.spacing(3),
    minWidth: 110,
  },
  value: {
    color: theme.color.textPrimary,
    fontFamily: theme.font.display,
    fontSize: theme.font.title,
    fontWeight: "800",
  },
  label: {
    color: theme.color.textSecondary,
    fontFamily: theme.font.display,
    fontSize: theme.font.caption,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
