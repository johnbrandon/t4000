import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { checkSession, login as apiLogin, setOnUnauthorized } from "../lib/api";
import { theme } from "../lib/theme";

type Status = "checking" | "anon" | "authed";

// Gates the whole app behind the single shared password. Sits above the theme
// provider so no data (or theme settings) is fetched until the session is valid.
export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkSession().then((ok) => {
      if (!cancelled) setStatus(ok ? "authed" : "anon");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // If a request 401s later (expired cookie), drop back to the login screen.
  useEffect(() => {
    setOnUnauthorized(() => setStatus("anon"));
    return () => setOnUnauthorized(null);
  }, []);

  async function handleSubmit() {
    if (!password) return;
    setSubmitting(true);
    setError(null);
    const ok = await apiLogin(password);
    setSubmitting(false);
    if (ok) {
      setPassword("");
      setStatus("authed");
    } else {
      setError("Incorrect password.");
    }
  }

  if (status === "authed") return <>{children}</>;

  if (status === "checking") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <View style={styles.card}>
        <Text style={styles.title}>Check In</Text>
        <Text style={styles.subtitle}>Enter your password to continue.</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.color.textMuted}
          secureTextEntry
          autoFocus
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={theme.color.background} />
          ) : (
            <Text style={styles.buttonLabel}>Log in</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.background,
    padding: theme.spacing(4),
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing(5),
  },
  title: {
    color: theme.color.textPrimary,
    fontSize: theme.font.hero,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  subtitle: {
    color: theme.color.textSecondary,
    fontSize: theme.font.body,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
  input: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing(3),
    color: theme.color.textPrimary,
    fontSize: theme.font.body,
  },
  error: {
    color: theme.color.danger,
    fontSize: theme.font.caption,
    marginTop: theme.spacing(2),
  },
  button: {
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(4),
    alignItems: "center",
    marginTop: theme.spacing(4),
  },
  buttonLabel: {
    color: theme.color.background,
    fontSize: theme.font.subtitle,
    fontWeight: "600",
  },
});
