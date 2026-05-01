import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import React, { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatBar } from "@/components/ChatBar";
import { SurahPickerModal } from "@/components/SurahPickerModal";
import { useMadhhab } from "@/contexts/MadhhabContext";
import { useModel } from "@/contexts/ModelContext";
import { useSect } from "@/contexts/SectContext";
import { useColors } from "@/hooks/useColors";
import {
  streamChat,
  streamGuardianChat,
  type AIIdentity,
  type ChatContext,
} from "@/services/aiService";
import { useAyah, useSurahList } from "@/services/quranApi";
import { surahs as staticSurahs } from "@/data/quran";

type SimpleTab = "teacher" | "scholar";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// ─── Quran Teacher tab ────────────────────────────────────────────────────────
function QuranTeacherView({
  identity,
  colors,
  insetBottom,
}: {
  identity: AIIdentity;
  colors: ReturnType<typeof useColors>;
  insetBottom: number;
}) {
  const [surahId, setSurahId] = useState(1);
  const [ayahNum, setAyahNum] = useState(1);
  const [pickerVisible, setPickerVisible] = useState(false);

  const { data: surahList } = useSurahList();
  const { data: ayahEn } = useAyah(surahId, ayahNum, "en.asad");
  const { data: ayahUr } = useAyah(surahId, ayahNum, "ur.jalandhry");

  const staticSurah = staticSurahs.find((s) => s.id === surahId);
  const staticAyahData = staticSurah?.ayahs.find((a) => a.number === ayahNum);
  const surahMeta = surahList?.find((s) => s.number === surahId);

  const arabic = ayahEn?.arabic ?? staticAyahData?.arabic ?? "";
  const translation = ayahEn?.translation ?? staticAyahData?.translation ?? "";
  const urduTranslation = ayahUr?.translation ?? "";
  const surahName = surahMeta?.englishName ?? staticSurah?.name ?? "Al-Fatiha";
  const surahArabic = surahMeta?.name ?? staticSurah?.arabicName ?? "الفاتحة";
  const revelationType = surahMeta?.revelationType ?? "Meccan";
  const maxAyah = surahMeta?.numberOfAyahs ?? 1;
  const background = `Revealed in ${revelationType === "Meccan" ? "Makkah" : "Madinah"}. Surah ${surahName} — ${maxAyah} verses.`;

  const goNext = useCallback(() => {
    if (ayahNum < maxAyah) {
      setAyahNum((n) => n + 1);
    } else if (surahId < 114) {
      setSurahId((s) => s + 1);
      setAyahNum(1);
    }
  }, [ayahNum, maxAyah, surahId]);

  const goPrev = useCallback(() => {
    if (ayahNum > 1) {
      setAyahNum((n) => n - 1);
    } else if (surahId > 1) {
      const prevMeta = surahList?.find((s) => s.number === surahId - 1);
      setSurahId((s) => s - 1);
      setAyahNum(prevMeta?.numberOfAyahs ?? 1);
    }
  }, [ayahNum, surahId, surahList]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const historyRef = useRef<Msg[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakArabic = useCallback(() => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    Speech.speak(arabic, {
      language: "ar-SA",
      rate: 0.8,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [arabic, isSpeaking]);

  const speakTranslation = useCallback(() => {
    Speech.speak(translation, { language: "en-US", rate: 0.9 });
  }, [translation]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const userMsg: Msg = { role: "user" as const, content: trimmed };
    const aiMsg: Msg = { role: "assistant" as const, content: "" };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    historyRef.current = [...historyRef.current, userMsg].slice(-20);
    setStreaming(true);

    const ctx: ChatContext = {
      surahName,
      surahArabic,
      ayahNumber: ayahNum,
      ayahArabic: arabic,
      ayahTranslation: translation,
      userLevel: "Beginner",
    };

    try {
      let full = "";
      await streamChat(
        { message: trimmed, context: ctx, history: historyRef.current.slice(0, -1), identity },
        (chunk) => {
          full += chunk;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant" as const, content: full };
            return next;
          });
          scrollRef.current?.scrollToEnd({ animated: false });
        },
        abortRef.current.signal,
      );
      historyRef.current = [
        ...historyRef.current,
        { role: "assistant" as const, content: full },
      ].slice(-20);
    } catch {}

    setStreaming(false);
  }, [streaming, surahName, surahArabic, ayahNum, arabic, translation, identity]);

  return (
    <>
      <SurahPickerModal
        visible={pickerVisible}
        currentSurah={surahId}
        onSelect={(num) => { setSurahId(num); setAyahNum(1); }}
        onClose={() => setPickerVisible(false)}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.teacherContent, { paddingBottom: insetBottom + 12 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Surah navigation */}
          <View style={[styles.surahNav, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable style={styles.navBtn} onPress={goPrev} hitSlop={10}>
              <Feather name="chevron-left" size={18} color={colors.primary} />
            </Pressable>
            <Pressable style={styles.surahLabel} onPress={() => setPickerVisible(true)}>
              <Text style={[styles.surahNameText, { color: colors.foreground }]}>{surahName}</Text>
              <Text style={[styles.ayahNumText, { color: colors.mutedForeground }]}>
                Ayah {ayahNum} / {maxAyah}
              </Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={goNext} hitSlop={10}>
              <Feather name="chevron-right" size={18} color={colors.primary} />
            </Pressable>
          </View>

          {/* Ayah card */}
          <View style={[styles.ayahCard, { backgroundColor: "#FEFCE8", borderColor: "#FDE68A" }]}>
            <Text style={styles.ayahArabic}>{arabic || "﷽"}</Text>
            <View style={styles.ayahBtns}>
              <Pressable style={styles.ayahBtn} onPress={speakArabic}>
                <Feather name={isSpeaking ? "pause" : "play"} size={20} color="#065F46" />
              </Pressable>
              <Pressable style={styles.ayahBtn} onPress={speakTranslation}>
                <Feather name="volume-2" size={20} color="#065F46" />
              </Pressable>
            </View>
          </View>

          {/* Info cards */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.infoIcon, { backgroundColor: "#DBEAFE" }]}>
              <Feather name="info" size={16} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>BACKGROUND</Text>
              <Text style={[styles.infoBody, { color: colors.foreground }]}>{background}</Text>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.infoIcon, { backgroundColor: "#D1FAE5" }]}>
              <Feather name="type" size={16} color="#065F46" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>TRANSLATION (URDU)</Text>
              <Text style={[styles.infoBodyRtl, { color: colors.foreground }]}>
                {urduTranslation || "شروع اللہ کے نام سے جو بڑا مہربان نہایت رحم والا ہے۔"}
              </Text>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.infoIcon, { backgroundColor: "#FEF3C7" }]}>
              <Feather name="book-open" size={16} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>BRIEF TAFSEER</Text>
              <Text style={[styles.infoBody, { color: colors.foreground }]}>{translation}</Text>
            </View>
          </View>

          {/* Chat messages */}
          {messages.length > 0 && (
            <View style={styles.chatSection}>
              {messages.map((msg, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    msg.role === "user"
                      ? [styles.bubbleUser, { backgroundColor: "#065F46" }]
                      : [styles.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border }],
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: msg.role === "user" ? "#fff" : colors.foreground }]}>
                    {msg.content || (streaming && i === messages.length - 1 ? "…" : "")}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <ChatBar
          value={input}
          onChange={setInput}
          onSend={() => sendMessage(input)}
          onVoice={sendMessage}
          disabled={streaming}
        />

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          ✨ POWERED BY NOORAI GUARDIAN ENGINE
        </Text>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── NoorAi Scholar tab ───────────────────────────────────────────────────────
function ScholarView({
  identity,
  colors,
  insetBottom,
}: {
  identity: AIIdentity;
  colors: ReturnType<typeof useColors>;
  insetBottom: number;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant" as const,
      content:
        "Assalamu Alaikum! I am your AI Scholar. I have analyzed all major Fiqh books. How can I assist you in your legal or spiritual journey today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const historyRef = useRef<Msg[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const userMsg: Msg = { role: "user" as const, content: trimmed };
    const aiMsg: Msg = { role: "assistant" as const, content: "" };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    historyRef.current = [...historyRef.current, userMsg].slice(-20);
    setStreaming(true);

    try {
      let full = "";
      await streamGuardianChat(
        { message: trimmed, history: historyRef.current.slice(0, -1), identity },
        (chunk) => {
          full += chunk;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant" as const, content: full };
            return next;
          });
          scrollRef.current?.scrollToEnd({ animated: false });
        },
        abortRef.current.signal,
      );
      historyRef.current = [
        ...historyRef.current,
        { role: "assistant" as const, content: full },
      ].slice(-20);
    } catch {}

    setStreaming(false);
  }, [streaming, identity]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scholarContent, { paddingBottom: insetBottom + 12 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <View
              key={i}
              style={[
                styles.bubble,
                isUser
                  ? [styles.bubbleUser, { backgroundColor: "#065F46" }]
                  : [styles.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border }],
              ]}
            >
              {!isUser && streaming && i === messages.length - 1 && !msg.content ? (
                <Text style={[styles.bubbleText, { color: colors.mutedForeground }]}>…</Text>
              ) : (
                <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
                  {msg.content}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <ChatBar
        value={input}
        onChange={setInput}
        onSend={() => sendMessage(input)}
        onVoice={sendMessage}
        disabled={streaming}
      />

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        ✨ POWERED BY NOORAI GUARDIAN ENGINE
      </Text>
    </KeyboardAvoidingView>
  );
}

// ─── Root simple screen ───────────────────────────────────────────────────────
export default function SimpleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { provider, modelId } = useModel();
  const { sect, subSchool } = useSect();
  const { madhhab } = useMadhhab();

  const [tab, setTab] = useState<SimpleTab>("teacher");

  const identity: AIIdentity = {
    provider: provider as AIIdentity["provider"],
    model: modelId,
    sect: sect as AIIdentity["sect"],
    subSchool,
    madhhab,
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={[styles.logoBox, { backgroundColor: "#065F46" }]}>
            <Text style={styles.logoLetter}>N</Text>
          </View>
          <Text style={[styles.appName, { color: "#065F46" }]}>NoorAi</Text>
        </View>
        <Pressable onPress={() => router.push("/profile")} hitSlop={10}>
          <Feather name="settings" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Top tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.secondary }]}>
        {(["teacher", "scholar"] as SimpleTab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabPill, tab === t && { backgroundColor: colors.background }]}
            onPress={() => {
              setTab(t);
              Haptics.selectionAsync().catch(() => {});
            }}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === t ? "#065F46" : colors.mutedForeground },
                tab === t && { fontWeight: "700" },
              ]}
            >
              {t === "teacher" ? "Quran Teacher" : "NoorAi Scholar"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {tab === "teacher" ? (
        <QuranTeacherView identity={identity} colors={colors} insetBottom={insets.bottom} />
      ) : (
        <ScholarView identity={identity} colors={colors} insetBottom={insets.bottom} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: { color: "#fff", fontSize: 16, fontWeight: "800" },
  appName: { fontSize: 20, fontWeight: "800" },

  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  tabText: { fontSize: 14, fontWeight: "500" },

  // Surah navigation
  surahNav: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 2,
  },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  surahLabel: { flex: 1, alignItems: "center" },
  surahNameText: { fontSize: 15, fontWeight: "700" },
  ayahNumText: { fontSize: 12, fontWeight: "400", marginTop: 2 },

  // Quran Teacher
  teacherContent: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  ayahCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  ayahArabic: {
    fontSize: 28,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 52,
    color: "#1a1a1a",
  },
  ayahBtns: { flexDirection: "row", gap: 24 },
  ayahBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(6,95,70,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  infoLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 },
  infoBody: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  infoBodyRtl: { fontSize: 14, fontWeight: "400", lineHeight: 22, textAlign: "right" },

  chatSection: { gap: 8, marginTop: 4 },
  scholarContent: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  bubble: { borderRadius: 16, padding: 14, maxWidth: "85%" },
  bubbleUser: { alignSelf: "flex-end" },
  bubbleAI: { alignSelf: "flex-start", borderWidth: 1 },
  bubbleText: { fontSize: 15, fontWeight: "400", lineHeight: 22 },

  footer: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textAlign: "center",
    paddingBottom: 8,
    paddingTop: 4,
  },
});