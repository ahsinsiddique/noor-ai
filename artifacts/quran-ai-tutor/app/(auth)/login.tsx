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

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);

  const handleLogin = async () => {
    setError("");
    if (!email.trim()) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }

    Keyboard.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/mode-select");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={[colors.primary, colors.primary + "dd", colors.background]}
        style={[styles.topGradient, { paddingTop: topPad + 20 }]}
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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Sign in to continue your Quran journey
        </Text>

        {/* Email */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>EMAIL</Text>
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
          <View pointerEvents="none" style={[styles.inputBorder, { borderColor: error && !email.trim() ? colors.destructive : focusedField === "email" ? colors.primary : colors.border, borderWidth: focusedField === "email" ? 2 : 1.5 }]} />
        </View>

        {/* Password */}
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 14 }]}>PASSWORD</Text>
        <View style={styles.inputOuter}>
          <View style={[styles.inputRow, { backgroundColor: colors.card }]}>
            <Feather name="lock" size={17} color={focusedField === "password" ? colors.primary : colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Your password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(""); }}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              autoComplete="password"
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
          <View pointerEvents="none" style={[styles.inputBorder, { borderColor: error && !password ? colors.destructive : focusedField === "password" ? colors.primary : colors.border, borderWidth: focusedField === "password" ? 2 : 1.5 }]} />
        </View>

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
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
              <Text style={styles.btnText}>Sign In</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </>
          }
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            { backgroundColor: colors.card, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.push("/(auth)/signup")}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Create new account</Text>
          <Feather name="user-plus" size={16} color={colors.primary} />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topGradient: { alignItems: "center", paddingBottom: 24, paddingHorizontal: 24 },
  logoImage: { width: 100, height: 100, marginBottom: 8 },
  appName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 24 },
  heading: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  subheading: { fontSize: 14, marginBottom: 24 },
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
    marginTop: 20,
  },
  btnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: "500" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600" },
});
