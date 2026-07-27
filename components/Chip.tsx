import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../lib/theme";

export default function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: theme.color.accentSoft, borderColor: theme.color.accent },
      ]}
    >
      <Text style={[styles.label, selected && { color: theme.color.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  label: {
    color: theme.color.textSecondary,
    fontSize: theme.font.caption,
    fontWeight: "500",
  },
});
