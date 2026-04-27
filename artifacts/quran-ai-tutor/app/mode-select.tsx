import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const MODES = [
  {
    id: "guardian",
    title: "The NoorAI Scholar",
    subtitle: "1-on-1 AI conversation for Islamic guidance",
    icon: "shield" as const,
    emoji: "🛡️",
    route: "/guardian" as const,
  },
  {
    id: "teacher",
    title: "The Online Quran Teacher",
    subtitle: "Learn Quran with AI-powered teachers",
    icon: "book-open" as const,
    emoji: "📖",
    route: "/(tabs)" as const,
  },
] as const;

export default function ModeSelectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  if (isLoading || !isAuthenticated) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary, colors.primary + "cc", colors.background]}
        style={[styles.header, { paddingTop: topPad + 24 }]}
        locations={[0, 0.6, 1]}
      >
        <Image
          source={require("@/assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Noor AI</Text>
        <Text style={styles.tagline}>Guiding Intelligence. Empowering Humanity.</Text>
      </LinearGradient>

      <View style={[styles.body, { paddingBottom: botPad + 24 }]}>
        <Text style={[styles.greeting, { color: colors.foreground }]}>
          Assalamu Alaikum, {user?.name || "Student"} 👋
        </Text>
        <Text style={[styles.chooseLabel, { color: colors.mutedForeground }]}>
          Choose your learning experience
        </Text>

        {MODES.map((mode) => (
          <Pressable
            key={mode.id}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(mode.route);
            }}
          >
            <View style={[styles.cardIconBox, { backgroundColor: colors.secondary }]}>
              <Text style={styles.cardEmoji}>{mode.emoji}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{mode.title}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>{mode.subtitle}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: "center", paddingBottom: 32, paddingHorizontal: 24 },
  logo: { width: 120, height: 120, marginBottom: 8 },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 24, justifyContent: "center" },
  greeting: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  chooseLabel: { fontSize: 14, marginBottom: 28 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    gap: 14,
  },
  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardEmoji: { fontSize: 24 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 3 },
  cardSubtitle: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
});
