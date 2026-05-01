import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type LearningLevel, useAuth } from "@/contexts/AuthContext";
import { type FeatureConfig, useFeatureConfig } from "@/contexts/FeatureConfigContext";
import { type Madhhab, MADHHABS, useMadhhab } from "@/contexts/MadhhabContext";
import { useModel } from "@/contexts/ModelContext";
import { SECTS, type SectId, getSectMeta, useSect } from "@/contexts/SectContext";
import { AI_PROVIDERS, type ProviderId } from "@/data/aiModels";
import { useColors } from "@/hooks/useColors";

const LEVELS: LearningLevel[] = ["Beginner", "Intermediate", "Advanced"];
const LEVEL_INFO: Record<LearningLevel, { icon: keyof typeof Feather.glyphMap; arabic: string }> = {
  Beginner: { icon: "star", arabic: "مبتدئ" },
  Intermediate: { icon: "book-open", arabic: "متوسط" },
  Advanced: { icon: "award", arabic: "متقدم" },
};

const FEATURE_TOGGLES: Array<{ key: keyof FeatureConfig; label: string; description: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: "showPrayerTimes", label: "Prayer Times", description: "Show prayer times on home screen", icon: "clock" },
  { key: "showTeacherSelection", label: "Choose Your Teacher", description: "Show teacher selection cards", icon: "users" },
  { key: "showAnalytics", label: "Analytics", description: "Show session stats on home screen", icon: "bar-chart-2" },
];

const MADHHAB_INFO: Record<Madhhab, { description: string }> = {
  Hanafi: { description: "Largest school; widely followed in South Asia, Turkey, and Central Asia." },
  "Shafi'i": { description: "Common in Egypt, East Africa, Southeast Asia, and parts of Yemen." },
  Maliki: { description: "Predominant in North and West Africa; emphasizes practice of Madinah." },
  Hanbali: { description: "Followed mainly in the Arabian Peninsula; closely tied to hadith tradition." },
};

function AIModelPicker({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { provider, modelId, setProvider, setModel } = useModel();

  return (
    <View>
      {/* Provider row */}
      <View style={aiStyles.providerRow}>
        {AI_PROVIDERS.map((p) => {
          const active = provider === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => { setProvider(p.id as ProviderId); Haptics.selectionAsync(); }}
              style={({ pressed }) => [
                aiStyles.providerCard,
                {
                  backgroundColor: active ? colors.secondary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text style={aiStyles.providerSymbol}>{p.symbol}</Text>
              <Text style={[aiStyles.providerName, { color: active ? colors.primary : colors.foreground }]}>
                {p.name}
              </Text>
              <Text style={[aiStyles.providerTagline, { color: colors.mutedForeground }]} numberOfLines={2}>
                {p.tagline}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* Model rows (only for the active provider) */}
      {AI_PROVIDERS.find((p) => p.id === provider)?.models.map((m) => {
        const active = modelId === m.id;
        return (
          <Pressable
            key={m.id}
            onPress={() => { setModel(provider as ProviderId, m.id); Haptics.selectionAsync(); }}
            style={({ pressed }) => [
              aiStyles.modelCard,
              {
                backgroundColor: active ? colors.secondary : colors.card,
                borderColor: active ? colors.primary : colors.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[aiStyles.modelName, { color: active ? colors.primary : colors.foreground }]}>
                {m.name}
              </Text>
              <Text style={[aiStyles.modelDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                {m.description}
              </Text>
            </View>
            <View style={[aiStyles.tierBadge, { backgroundColor: colors.border }]}>
              <Text style={[aiStyles.tierText, { color: colors.mutedForeground }]}>{m.tier}</Text>
            </View>
            {active && <Feather name="check-circle" size={16} color={colors.primary} style={{ marginLeft: 8 }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function SectPicker({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { sect, subSchool, setSect, setSubSchool } = useSect();
  const activeMeta = sect ? getSectMeta(sect) : null;

  return (
    <View>
      <View style={aiStyles.sectGrid}>
        {SECTS.map((s) => {
          const active = sect === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => { setSect(s.id as SectId); Haptics.selectionAsync(); }}
              style={({ pressed }) => [
                aiStyles.sectCard,
                {
                  backgroundColor: active ? colors.secondary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[aiStyles.sectName, { color: active ? colors.primary : colors.foreground }]}>
                  {s.shortName}
                </Text>
                {active && <Feather name="check-circle" size={14} color={colors.primary} />}
              </View>
              <Text style={[aiStyles.sectDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
                {s.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {activeMeta?.subSchools && activeMeta.subSchools.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.label, { color: colors.mutedForeground, marginBottom: 6 }]}>
            SUB-SCHOOL
          </Text>
          <View style={aiStyles.subSchoolRow}>
            {activeMeta.subSchools.map((ss) => {
              const active = subSchool === ss;
              return (
                <Pressable
                  key={ss}
                  onPress={() => { setSubSchool(ss); Haptics.selectionAsync(); }}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderRadius: 18, borderWidth: 1.5,
                    backgroundColor: active ? colors.primary : "transparent",
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#fff" : colors.foreground }}>
                    {ss}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const aiStyles = StyleSheet.create({
  providerRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  providerCard: {
    flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 12,
  },
  providerSymbol: { fontSize: 20, marginBottom: 4 },
  providerName: { fontSize: 14, fontWeight: "700" },
  providerTagline: { fontSize: 11, marginTop: 2 },
  modelCard: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 12, padding: 10, marginBottom: 6, gap: 10,
  },
  modelName: { fontSize: 14, fontWeight: "600" },
  modelDesc: { fontSize: 11, marginTop: 2 },
  tierBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  tierText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  sectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectCard: {
    flexBasis: "48%", flexGrow: 1, borderWidth: 1.5, borderRadius: 12, padding: 12,
  },
  sectName: { fontSize: 14, fontWeight: "700" },
  sectDesc: { fontSize: 11, marginTop: 4 },
  subSchoolRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});

function MadhhabPicker({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { madhhab, setMadhhab } = useMadhhab();

  return (
    <View style={styles.madhhabGrid}>
      {MADHHABS.map((m) => {
        const active = madhhab === m;
        return (
          <Pressable
            key={m}
            onPress={() => { setMadhhab(m); Haptics.selectionAsync(); }}
            style={({ pressed }) => [
              styles.madhhabCard,
              {
                backgroundColor: active ? colors.secondary : colors.card,
                borderColor: active ? colors.primary : colors.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <View style={styles.madhhabHeader}>
              <Text style={[styles.madhhabName, { color: active ? colors.primary : colors.foreground }]}>{m}</Text>
              {active && <Feather name="check-circle" size={14} color={colors.primary} />}
            </View>
            <Text style={[styles.madhhabDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
              {MADHHAB_INFO[m].description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FeatureToggles({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { config, setFeature } = useFeatureConfig();

  return (
    <View style={styles.toggleGroup}>
      {FEATURE_TOGGLES.map(({ key, label, description, icon }) => (
        <View key={key} style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.toggleIconBox, { backgroundColor: colors.secondary }]}>
            <Feather name={icon} size={16} color={colors.primary} />
          </View>
          <View style={styles.toggleTextBox}>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
            <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>{description}</Text>
          </View>
          <Switch
            value={config[key]}
            onValueChange={(val) => {
              setFeature(key, val);
              Haptics.selectionAsync();
            }}
            trackColor={{ false: colors.border, true: colors.primary + "88" }}
            thumbColor={config[key] ? colors.primary : colors.mutedForeground}
          />
        </View>
      ))}
    </View>
  );
}

function AppModeToggle({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { config, setFeature } = useFeatureConfig();
  const isSimple = config.simpleMode;

  const switchMode = (simple: boolean) => {
    setFeature("simpleMode", simple);
    Haptics.selectionAsync().catch(() => {});
    // Navigate immediately so the user lands on the right home
    if (simple) {
      router.replace("/simple" as never);
    } else {
      router.replace("/mode-select");
    }
  };

  return (
    <View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>APP MODE</Text>
      <View style={[modeStyles.row, { backgroundColor: colors.secondary }]}>
        <Pressable
          style={[modeStyles.pill, !isSimple && { backgroundColor: colors.background }]}
          onPress={() => switchMode(false)}
        >
          <Feather name="layers" size={15} color={!isSimple ? colors.primary : colors.mutedForeground} />
          <Text style={[modeStyles.pillText, { color: !isSimple ? colors.primary : colors.mutedForeground, fontWeight: !isSimple ? "700" : "500" }]}>
            Advanced
          </Text>
        </Pressable>
        <Pressable
          style={[modeStyles.pill, isSimple && { backgroundColor: colors.background }]}
          onPress={() => switchMode(true)}
        >
          <Feather name="smartphone" size={15} color={isSimple ? colors.primary : colors.mutedForeground} />
          <Text style={[modeStyles.pillText, { color: isSimple ? colors.primary : colors.mutedForeground, fontWeight: isSimple ? "700" : "500" }]}>
            Simple
          </Text>
        </Pressable>
      </View>
      <Text style={[modeStyles.hint, { color: colors.mutedForeground }]}>
        {isSimple
          ? "Clean single-page view — ayah, translation, tafseer, and chat."
          : "Full-featured app — all tabs, quiz, history, and teacher selection."}
      </Text>
    </View>
  );
}

const modeStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pillText: { fontSize: 14 },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, updateProfile, logout } = useAuth();

  // Guard: redirect unauthenticated access
  useEffect(() => {
    if (!isAuthenticated && !user) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, user]);

  const [name, setName] = useState(user?.name ?? "");
  const [level, setLevel] = useState<LearningLevel>((user?.level as LearningLevel) ?? "Beginner");
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  // Refs let us auto-save without forming new closures on every keystroke
  const nameRef = useRef(name);
  const levelRef = useRef(level);
  const lastSavedRef = useRef({ name: user?.name ?? "", level: (user?.level as LearningLevel) ?? "Beginner" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { levelRef.current = level; }, [level]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setLevel(user.level as LearningLevel);
      lastSavedRef.current = { name: user.name, level: user.level as LearningLevel };
    }
  }, [user]);

  const persist = useCallback(async () => {
    const trimmed = nameRef.current.trim();
    if (!trimmed) { setError("Name is required"); return; }
    const lvl = levelRef.current;
    if (trimmed === lastSavedRef.current.name && lvl === lastSavedRef.current.level) return;
    setError("");
    try {
      await updateProfile(trimmed, lvl);
      lastSavedRef.current = { name: trimmed, level: lvl };
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setSavedFlash(true);
      flashTimerRef.current = setTimeout(() => setSavedFlash(false), 1400);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  }, [updateProfile]);

  // Auto-save name with debounce
  useEffect(() => {
    if (!user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void persist(); }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, persist, user]);

  // Auto-save level immediately (cancel any pending debounced name save and persist together)
  useEffect(() => {
    if (!user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void persist();
  }, [level, persist, user]);

  // Flush pending changes if the screen is closed
  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      void persist();
    }
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, [persist]);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      logout().then(() => router.replace("/(auth)/login"));
      return;
    }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => logout().then(() => router.replace("/(auth)/login")),
      },
    ]);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 14 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Your Profile</Text>
          <Text style={styles.headerSub}>{user?.email}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App Mode */}
        <AppModeToggle colors={colors} />
        <View style={[styles.sectionDivider, { borderTopColor: colors.border, marginTop: 20, marginBottom: 20 }]} />

        {/* Name */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>DISPLAY NAME</Text>
        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="user" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={name}
            onChangeText={(t) => { setName(t); setError(""); }}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="done"
          />
        </View>

        {/* Level */}
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
              <View style={[styles.levelIcon, { backgroundColor: active ? "rgba(255,255,255,0.18)" : colors.secondary }]}>
                <Feather name={info.icon} size={18} color={active ? "#fff" : colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.levelName, { color: active ? "#fff" : colors.foreground }]}>{l}</Text>
                  <Text style={[styles.levelArabic, { color: active ? "rgba(255,255,255,0.8)" : colors.accent }]}>{info.arabic}</Text>
                </View>
              </View>
              {active && <Feather name="check-circle" size={16} color="rgba(255,255,255,0.9)" />}
            </Pressable>
          );
        })}

        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive }]}>
            <Feather name="alert-circle" size={13} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}
        {savedFlash && !error && (
          <View style={styles.savedRow}>
            <Feather name="check-circle" size={12} color={colors.primary} />
            <Text style={[styles.savedText, { color: colors.primary }]}>Saved</Text>
          </View>
        )}

        {/* Divider */}
        <View style={[styles.sectionDivider, { borderTopColor: colors.border }]} />

        {/* AI Model */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>AI MODEL</Text>
        <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
          Choose which AI answers your questions. You can switch anytime.
        </Text>
        <AIModelPicker colors={colors} />

        {/* Divider */}
        <View style={[styles.sectionDivider, { borderTopColor: colors.border }]} />

        {/* Sect (Tradition) */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>TRADITION (SECT)</Text>
        <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
          We frame answers within your tradition. Non-denominational stays on points of consensus.
        </Text>
        <SectPicker colors={colors} />

        {/* Divider */}
        <View style={[styles.sectionDivider, { borderTopColor: colors.border }]} />

        {/* Madhhab (Sunni sub-school) */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>SCHOOL OF THOUGHT (MADHHAB)</Text>
        <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
          For Sunni users — your AI teacher and Noor AI Scholar will prefer rulings from this school when answering questions on prayer, fiqh, and practice.
        </Text>
        <MadhhabPicker colors={colors} />

        {/* Divider */}
        <View style={[styles.sectionDivider, { borderTopColor: colors.border }]} />

        {/* Feature Toggles */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>HOME SCREEN FEATURES</Text>
        <FeatureToggles colors={colors} />

        {/* Divider */}
        <View style={[styles.sectionDivider, { borderTopColor: colors.border }]} />

        {/* Sign out */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            { backgroundColor: colors.card, borderColor: colors.destructive + "60", opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: "400", minWidth: 0 },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  levelIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  levelName: { fontSize: 14, fontWeight: "600" },
  levelArabic: { fontSize: 13, fontWeight: "500" },
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
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
    marginTop: 10,
  },
  savedText: { fontSize: 12, fontWeight: "600" },
  sectionDivider: { borderTopWidth: 1, marginTop: 28, marginBottom: 20 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  logoutText: { fontSize: 15, fontWeight: "600" },
  toggleGroup: { gap: 10, marginBottom: 4 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  toggleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTextBox: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: "600", marginBottom: 1 },
  toggleDesc: { fontSize: 12, fontWeight: "400" },
  helperText: { fontSize: 12, lineHeight: 17, marginTop: -2, marginBottom: 12 },
  madhhabGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  madhhabCard: {
    width: "48%",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    minHeight: 92,
  },
  madhhabHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  madhhabName: { fontSize: 15, fontWeight: "700" },
  madhhabDesc: { fontSize: 11, lineHeight: 15, fontWeight: "400" },
});
