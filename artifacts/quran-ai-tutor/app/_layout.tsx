import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Font from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { FeatureConfigProvider } from "@/contexts/FeatureConfigContext";
import { MadhhabProvider } from "@/contexts/MadhhabContext";
import { ModelProvider } from "@/contexts/ModelContext";
import { SectProvider } from "@/contexts/SectContext";
import { SessionProvider } from "@/contexts/SessionContext";
import { TeacherProvider } from "@/contexts/TeacherContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { logApiConfig } from "@/services/apiClient";

// One-time log so misconfigured EXPO_PUBLIC_API_URL surfaces immediately.
logApiConfig();

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="mode-select" options={{ headerShown: false }} />
      <Stack.Screen name="guardian" options={{ headerShown: false }} />
      <Stack.Screen
        name="call-noor"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="quiz"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="simple" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load all fonts imperatively so we have full control over the promise.
    // Using Font.loadAsync directly (not useFonts) avoids the React-Compiler
    // memoisation quirks and ensures the native font registry is populated
    // before ANY component that reads fontFamily renders on Fabric (new arch).
    //
    // Feather is loaded from the LOCAL copy in assets/fonts/ — NOT the
    // pnpm-symlinked node_modules path — so Metro always serves the asset
    // bytes correctly to iOS and Android Expo Go clients.
    Font.loadAsync({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
      // key MUST be lowercase 'feather' — that is what @expo/vector-icons/Feather
      // uses internally (createIconSet(glyphMap, 'feather', ...)).
      feather: require("../assets/fonts/Feather.ttf"),
    })
      .catch(() => {
        // Font load failure is non-fatal; render with system fallback.
      })
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync();
      });
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <FeatureConfigProvider>
                <SectProvider>
                  <MadhhabProvider>
                    <ModelProvider>
                      <TeacherProvider>
                        <SessionProvider>
                          <GestureHandlerRootView>
                            <KeyboardProvider>
                              <RootLayoutNav />
                            </KeyboardProvider>
                          </GestureHandlerRootView>
                        </SessionProvider>
                      </TeacherProvider>
                    </ModelProvider>
                  </MadhhabProvider>
                </SectProvider>
              </FeatureConfigProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
