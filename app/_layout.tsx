import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LoginGate from "../components/LoginGate";
import { ThemeProvider, useThemeName } from "../lib/ThemeContext";
import { registerPwa } from "../lib/pwa";
import { theme } from "../lib/theme";

export default function RootLayout() {
  useEffect(() => {
    registerPwa();
  }, []);

  return (
    <SafeAreaProvider>
      <LoginGate>
        <ThemeProvider>
          <Chrome />
        </ThemeProvider>
      </LoginGate>
    </SafeAreaProvider>
  );
}

function Chrome() {
  const name = useThemeName();
  return (
    <>
      <StatusBar style={name === "night" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.color.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
