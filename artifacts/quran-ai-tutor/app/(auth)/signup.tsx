import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type LearningLevel, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const LEVELS: LearningLevel[] = ["Beginner", "Intermediate", "Advanced"];
const LEVEL_INFO: Record<LearningLevel, { icon: keyof typeof Feather.glyphMap; description: string; arabic: string }> = {
  Beginner: { icon: "star", description: "New to Quran, learning the basics", arabic: "مبتدئ" },
  Intermediate: { icon: "book-open", description: "Familiar with some surahs and Arabic", arabic: "متوسط" },
  Advanced: { icon: "award", description: "Seeking deeper understanding", arabic: "متقدم" },
};

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<LearningLevel>("Beginner");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"name" | "email" | "password" | null>(null);

  const handleSignup = async () => {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (!password || password.length < 6) { setError("Password must be at least 6 characters"); return; }

    Keyboard.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password, level);
      router.replace("/mode-select");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={[colors.primary, colors.primary + "dd", colors.background]}
        style={[styles.topGradient, { paddingTop: topPad + 16 }]}
        locations={[0, 0.55, 1]}
      >
        <Image
          source={require("@/assets/images/logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Noor AI</Text>
        <Text style={styles.tagline}>تعلّم القرآن مع المعلم الذكي</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>Create account</Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Start your personalised Quran journey
        </Text>

        {/* Name */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>YOUR NAME</Text>
        <View style={styles.inputOuter}>
          <View style={[styles.inputRow, { backgroundColor: colors.card }]}>
            <Feather name="user" size={17} color={focusedField === "name" ? colors.primary : colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Enter your name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={(t) => { setName(t); setError(""); }}
              returnKeyType="next"
              underlineColorAndroid="transparent"
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          <View pointerEvents="none" style={[styles.inputBorder, { borderColor: focusedField === "name" ? colors.primary : colors.border, borderWidth: focusedField === "name" ? 2 : 1.5 }]} />
        </View>

        {/* Email */}
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 14 }]}>EMAIL</Text>
        <View style={styles.inputOuter}>
          <View style={[styles.inputRow, { backgroundColor: colors.card }]}>
            <Feather name="mail" size={17} color={focusedField === "email" ? colors.primary : colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              autoComplete="email"
              underlineColorAndroid="transparent"
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          <View pointerEvents="none" style={[styles.inputBorder, { borderColor: focusedField === "email" ? colors.primary : colors.border, borderWidth: focusedField === "email" ? 2 : 1.5 }]} />
        </View>

        {/* Password */}
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 14 }]}>PASSWORD</Text>
        <View style={styles.inputOuter}>
          <View style={[styles.inputRow, { backgroundColor: colors.card }]}>
            <Feather name="lock" size={17} color={focusedField === "password" ? colors.primary : colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Minimum 6 characters"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(""); }}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              autoComplete="new-password"
              underlineColorAndroid="transparent"
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={17} color={focusedField === "password" ? colors.primary : colors.mutedForeground} />
            </Pressable>
          </View>
          <View pointerEvents="none" style={[styles.inputBorder, { borderColor: focusedField === "password" ? colors.primary : colors.border, borderWidth: focusedField === "password" ? 2 : 1.5 }]} />
        </View>

        {/* Learning Level */}
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 18 }]}>LEARNING LEVEL</Text>
        {LEVELS.map((l) => {
          const info = LEVEL_INFO[l];
          const active = level === l;
          return (
            <Pressable
              key={l}
              onPress={() => { setLevel(l); Haptics.selectionAsync(); }}
              style={({ pressed }) => [
                styles.levelCard,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <View style={[styles.levelIconBox, { backgroundColor: active ? "rgba(255,255,255,0.18)" : colors.secondary }]}>
                <Feather name={info.icon} size={20} color={active ? "#fff" : colors.accent} />
              </View>
              <View style={styles.levelText}>
                <View style={styles.levelTitleRow}>
                  <Text style={[styles.levelTitle, { color: active ? "#fff" : colors.foreground }]}>{l}</Text>
                  <Text style={[styles.levelArabic, { color: active ? "rgba(255,255,255,0.8)" : colors.accent }]}>{info.arabic}</Text>
                </View>
                <Text style={[styles.levelDesc, { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>{info.description}</Text>
              </View>
              {active && <Feather name="check-circle" size={18} color="rgba(255,255,255,0.9)" />}
            </Pressable>
          );
        })}

        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive }]}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 },
          ]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
              <Text style={styles.btnText}>Begin Learning</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </>
          }
        </Pressable>

        <Pressable
          style={styles.loginLink}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={[styles.loginLinkText, { color: colors.mutedForeground }]}>
            Already have an account?{" "}
            <Text style={{ color: colors.primary, fontWeight: "600" }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topGradient: { alignItems: "center", paddingBottom: 20, paddingHorizontal: 24 },
  logoImage: { width: 90, height: 90, marginBottom: 6 },
  appName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "500",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 20 },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  subheading: { fontSize: 13, marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 7 },
  inputOuter: { position: "relative" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 58,
  },
  inputBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: "transparent",
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
    minWidth: 0,
    height: 58,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  eyeBtn: { paddingLeft: 8 },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  levelIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  levelText: { flex: 1 },
  levelTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  levelTitle: { fontSize: 14, fontWeight: "600" },
  levelArabic: { fontSize: 13, fontWeight: "500" },
  levelDesc: { fontSize: 12, fontWeight: "400" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontWeight: "500", flex: 1 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 18,
  },
  btnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  loginLink: { alignItems: "center", marginTop: 18 },
  loginLinkText: { fontSize: 14 },
});
