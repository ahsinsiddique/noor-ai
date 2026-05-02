import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
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
import { useAuth } from "@/contexts/AuthContext";
import { useMadhhab } from "@/contexts/MadhhabContext";
import { useModel } from "@/contexts/ModelContext";
import { useSect } from "@/contexts/SectContext";
import { useColors } from "@/hooks/useColors";
import {
  detectTtsLanguage,
  streamChat,
  streamGuardianChat,
  type AIIdentity,
  type ChatContext,
} from "@/services/aiService";
import { useAyah, useSurahList } from "@/services/quranApi";
import { surahs as staticSurahs } from "@/data/quran";

type SimpleTab = "teacher" | "scholar";

// ─── Shared types ─────────────────────────────────────────────────────────────
interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Animated typing dots (same as guardian.tsx) ──────────────────────────────
function TypingDots({ color }: { color: string }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.ease, useNativeDriver: true }),
          Animated.delay((dots.length - i - 1) * 160),
        ])
      )
    );
    Animated.parallel(animations).start();
    return () => animations.forEach((a) => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={dotStyles.row}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            dotStyles.dot,
            { backgroundColor: color, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 4, paddingHorizontal: 4, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

const SUGGESTIONS = [
  "What dua should I read before sleeping?",
  "How can I strengthen my Iman?",
  "Tell me about the importance of Salah",
  "What does Islam say about patience?",
];

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

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakArabic = useCallback(() => {
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); return; }
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

    const msgId = `u-${Date.now()}`;
    const aiId = `a-${Date.now() + 1}`;
    const userMsg: ChatMsg = { id: msgId, role: "user", content: trimmed, timestamp: Date.now() };
    const aiMsg: ChatMsg = { id: aiId, role: "assistant", content: "", timestamp: Date.now() + 1 };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    historyRef.current = [...historyRef.current, { role: "user", content: trimmed }].slice(-20);
    setStreaming(true);

    const ctx: ChatContext = {
      surahName, surahArabic,
      ayahNumber: ayahNum,
      ayahArabic: arabic,
      ayahTranslation: translation,
      userLevel: "Beginner",
    };

    try {
      await streamChat(
        { message: trimmed, context: ctx, history: historyRef.current.slice(0, -1), identity },
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => m.id === aiId ? { ...m, content: m.content + chunk } : m)
          );
          scrollRef.current?.scrollToEnd({ animated: false });
        },
        abortRef.current.signal,
      );
      const fullContent = await new Promise<string>((resolve) => {
        setMessages((prev) => {
          const ai = prev.find((m) => m.id === aiId);
          resolve(ai?.content ?? "");
          return prev;
        });
      });
      historyRef.current = [...historyRef.current, { role: "assistant", content: fullContent }].slice(-20);
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
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <View key={msg.id} style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
                    <View style={[
                      styles.bubble,
                      isUser
                        ? [styles.bubbleUser, { backgroundColor: "#065F46" }]
                        : [styles.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border }],
                    ]}>
                      {msg.content === "" && !isUser ? (
                        <TypingDots color={colors.mutedForeground} />
                      ) : (
                        <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
                          {msg.content}
                        </Text>
                      )}
                      <View style={styles.bubbleMeta}>
                        <Text style={[styles.bubbleTime, { color: isUser ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
                          {formatTime(msg.timestamp)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
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

// ─── NoorAi Scholar tab — full Noor AI experience ────────────────────────────
function ScholarView({
  identity,
  colors,
  insetBottom,
}: {
  identity: AIIdentity;
  colors: ReturnType<typeof useColors>;
  insetBottom: number;
}) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMsg[]>([{
    id: "welcome",
    role: "assistant",
    content: `Bismillah! 🌿\n\nAssalamu Alaikum${user?.name ? `, ${user.name}` : ""}!\n\nI am Noor AI — your Digital Guardian & Scholar. Ask me anything about Islam, daily guidance, duas, Islamic history, or spirituality.\n\nI'm here to help you on your journey. 🤲`,
    timestamp: Date.now(),
  }]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voicesByLangRef = useRef<Record<string, string | undefined>>({});
  const langSupportedRef = useRef<Record<string, boolean>>({ en: true, hi: true, ur: true });
  const voicesLoadedRef = useRef(false);
  const missingLangAlertedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      Speech.stop();
    };
  }, []);

  const loadVoices = useCallback(async () => {
    if (voicesLoadedRef.current) return;
    voicesLoadedRef.current = true;
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const PREFIXES: Record<string, string[]> = { en: ["en", "eng"], hi: ["hi", "hin"], ur: ["ur", "urd"] };
      const matchesFor = (lang: string) => {
        const prefixes = PREFIXES[lang] ?? [lang];
        return voices.filter((v) => prefixes.some((p) => (v.language ?? "").toLowerCase().startsWith(p)));
      };
      const pickMaleId = (list: typeof voices): string | undefined => {
        if (list.length === 0) return undefined;
        const male = list.find((v) => /male|rishi|salman|aamir|onyx|daniel|fred|alex/i.test(v.identifier + " " + ((v as { name?: string }).name ?? "")));
        return (male ?? list[0]).identifier;
      };
      const result: Record<string, string | undefined> = {};
      const supported: Record<string, boolean> = {};
      for (const lang of Object.keys(PREFIXES)) {
        const list = matchesFor(lang);
        result[lang] = pickMaleId(list);
        supported[lang] = list.length > 0;
      }
      voicesByLangRef.current = result;
      langSupportedRef.current = supported;
    } catch {}
  }, []);

  useEffect(() => { void loadVoices(); }, [loadVoices]);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setSpeakingId(null);
  }, []);

  const playWithVoice = useCallback(async (msg: ChatMsg) => {
    stopSpeaking();
    await loadVoices();
    const lang = detectTtsLanguage(msg.content);
    const localeCode = lang === "hi" ? "hi-IN" : lang === "ur" ? "ur-PK" : "en-US";
    const supported = langSupportedRef.current[lang] ?? true;

    if (!supported && !missingLangAlertedRef.current[lang]) {
      missingLangAlertedRef.current[lang] = true;
      const langName = lang === "hi" ? "Hindi" : lang === "ur" ? "Urdu" : "this language";
      const where = Platform.OS === "ios"
        ? "Settings → Accessibility → Spoken Content → Voices"
        : "Settings → System → Languages & input → Text-to-speech output";
      Alert.alert(`${langName} voice not installed`, `Install one from: ${where}.`);
    }

    setSpeakingId(msg.id);
    const speakWith = (voiceId: string | undefined, retry: boolean) => {
      Speech.speak(msg.content, {
        language: localeCode,
        ...(voiceId ? { voice: voiceId } : {}),
        rate: 0.92,
        pitch: 0.88,
        onDone: () => setSpeakingId((cur) => (cur === msg.id ? null : cur)),
        onStopped: () => setSpeakingId((cur) => (cur === msg.id ? null : cur)),
        onError: () => {
          if (retry && voiceId) speakWith(undefined, false);
          else setSpeakingId((cur) => (cur === msg.id ? null : cur));
        },
      });
    };
    speakWith(voicesByLangRef.current[lang], true);
  }, [stopSpeaking, loadVoices]);

  const speakMessage = useCallback(async (msg: ChatMsg) => {
    if (speakingId === msg.id) { stopSpeaking(); return; }
    await playWithVoice(msg);
  }, [speakingId, stopSpeaking, playWithVoice]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput("");
    setShowSuggestions(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const aiId = `a-${Date.now() + 1}`;
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: trimmed, timestamp: Date.now() };
    const aiMsg: ChatMsg = { id: aiId, role: "assistant", content: "", timestamp: Date.now() + 1 };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setStreaming(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    let finalContent = "";

    try {
      await streamGuardianChat(
        { message: trimmed, history, identity },
        (delta) => {
          finalContent += delta;
          setMessages((prev) =>
            prev.map((m) => m.id === aiId ? { ...m, content: m.content + delta } : m)
          );
          scrollRef.current?.scrollToEnd({ animated: false });
        },
        abortRef.current.signal,
      );
      if (finalContent.trim()) {
        playWithVoice({ id: aiId, role: "assistant", content: finalContent, timestamp: Date.now() }).catch(() => {});
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        setMessages((prev) =>
          prev.map((m) => m.id === aiId ? { ...m, content: "I couldn't connect right now. Please check your connection and try again." } : m)
        );
      }
    }

    setStreaming(false);
  }, [streaming, messages, identity, playWithVoice]);

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
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isSpeaking = speakingId === msg.id;
          return (
            <View key={msg.id} style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
              <View style={[
                styles.bubble,
                isUser
                  ? [styles.bubbleUser, { backgroundColor: "#065F46" }]
                  : [styles.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border }],
              ]}>
                {msg.content === "" && !isUser ? (
                  <TypingDots color={colors.mutedForeground} />
                ) : (
                  <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
                    {msg.content}
                  </Text>
                )}
                <View style={styles.bubbleMeta}>
                  <Text style={[styles.bubbleTime, { color: isUser ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
                    {formatTime(msg.timestamp)}
                  </Text>
                  {!isUser && msg.content !== "" && (
                    <Pressable onPress={() => speakMessage(msg)} hitSlop={6}>
                      <Feather
                        name={isSpeaking ? "volume-x" : "volume-2"}
                        size={13}
                        color={isSpeaking ? "#065F46" : colors.mutedForeground}
                      />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        {showSuggestions && messages.length <= 1 && (
          <View style={styles.suggestionsBox}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                style={({ pressed }) => [styles.suggestionChip, { borderColor: "#065F46", opacity: pressed ? 0.7 : 1 }]}
                onPress={() => sendMessage(s)}
              >
                <Text style={[styles.suggestionText, { color: "#065F46" }]}>{s}</Text>
              </Pressable>
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
        placeholder="Ask Noor AI…"
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
        <View style={styles.headerActions}>
          {tab === "scholar" && (
            <Pressable
              onPress={() => router.push("/call-noor")}
              style={[styles.headerIconBtn, { backgroundColor: colors.secondary }]}
              hitSlop={10}
              accessibilityLabel="Call Noor (voice mode)"
            >
              <Feather name="phone" size={18} color={colors.primary} />
            </Pressable>
          )}
          <Pressable onPress={() => router.push("/profile")} hitSlop={10}>
            <Feather name="settings" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>
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
  logoBox: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  logoLetter: { color: "#fff", fontSize: 16, fontWeight: "800" },
  appName: { fontSize: 20, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabPill: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
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
  ayahCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center", gap: 16 },
  ayahArabic: { fontSize: 28, fontWeight: "400", textAlign: "center", lineHeight: 52, color: "#1a1a1a" },
  ayahBtns: { flexDirection: "row", gap: 24 },
  ayahBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(6,95,70,0.1)", alignItems: "center", justifyContent: "center" },
  infoCard: { flexDirection: "row", alignItems: "flex-start", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  infoLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 },
  infoBody: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  infoBodyRtl: { fontSize: 14, fontWeight: "400", lineHeight: 22, textAlign: "right" },

  // Chat (shared)
  chatSection: { gap: 8, marginTop: 4 },
  scholarContent: { paddingHorizontal: 14, paddingTop: 8, gap: 4 },
  bubbleRow: { marginBottom: 8 },
  bubbleRowUser: { alignItems: "flex-end" },
  bubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { alignSelf: "flex-start", borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, fontWeight: "400", lineHeight: 22 },
  bubbleMeta: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 4 },
  bubbleTime: { fontSize: 10, fontWeight: "500" },

  // Suggestions
  suggestionsBox: { paddingVertical: 8, gap: 8, alignItems: "center" },
  suggestionChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  suggestionText: { fontSize: 13, fontWeight: "500" },

  footer: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6, textAlign: "center", paddingBottom: 8, paddingTop: 4 },
});