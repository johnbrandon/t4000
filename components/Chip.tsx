import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../lib/theme";

export default function Chip({
  label,
  selected = false,
  color,
  onPress,
}: {
  label: string;
  selected?: boolean;
  color?: string;
  onPress?: () => void;
}) {
  const accent = color ?? theme.color.accent;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: accent + "26", borderColor: accent },
      ]}
    >
      <Text style={[styles.label, selected && { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  label: {
    color: theme.color.textSecondary,
    fontFamily: theme.font.display,
    fontSize: theme.font.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
