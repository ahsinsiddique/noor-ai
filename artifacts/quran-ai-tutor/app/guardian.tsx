import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useAuth } from "@/contexts/AuthContext";
import { type Madhhab, MADHHABS, useMadhhab } from "@/contexts/MadhhabContext";
import { useModel } from "@/contexts/ModelContext";
import { useSect } from "@/contexts/SectContext";
import { useColors } from "@/hooks/useColors";
import { detectTtsLanguage, streamGuardianChat } from "@/services/aiService";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
  }, []);

  return (
    <View style={typingStyles.row}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            typingStyles.dot,
            { backgroundColor: color, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 4, paddingHorizontal: 4, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

const SUGGESTIONS = [
  "What dua should I read before sleeping?",
  "How can I strengthen my Iman?",
  "Tell me about the importance of Salah",
  "What does Islam say about patience?",
];

export default function GuardianScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { madhhab, setMadhhab, loaded: madhhabLoaded } = useMadhhab();
  const { sect, subSchool } = useSect();
  const { provider, modelId } = useModel();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draftMadhhab, setDraftMadhhab] = useState<Madhhab>(madhhab ?? "Hanafi");

  // Auto-open Preferences on first visit (no madhhab set yet)
  useEffect(() => {
    if (madhhabLoaded && !madhhab) {
      setDraftMadhhab("Hanafi");
      setPrefsOpen(true);
    }
  }, [madhhabLoaded, madhhab]);

  const openPrefs = useCallback(() => {
    setDraftMadhhab(madhhab ?? "Hanafi");
    setPrefsOpen(true);
    Haptics.selectionAsync();
  }, [madhhab]);

  const savePrefs = useCallback(() => {
    setMadhhab(draftMadhhab);
    setPrefsOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [draftMadhhab, setMadhhab]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading]);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Cache best male voice per language so we sound like a scholar, not the default
  const voicesByLangRef = useRef<Record<string, string | undefined>>({});
  const langSupportedRef = useRef<Record<string, boolean>>({ en: true, hi: true, ur: true });
  const voicesLoadedRef = useRef(false);
  const missingLangAlertedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Bismillah! 🌿\n\nAssalamu Alaikum, ${user?.name || "dear student"}!\n\nI am Noor AI — your Digital Guardian & Scholar. Ask me anything about Islam, daily guidance, duas, Islamic history, or spirituality.\n\nI'm here to help you on your journey. 🤲`,
        timestamp: Date.now(),
      },
    ]);
    return () => {
      abortRef.current?.abort();
      Speech.stop();
    };
  }, []);

  // Load installed device voices once and pick a scholarly male voice per language.
  // We accept BOTH 2-letter (hi-IN) and 3-letter (hin-IND) language tags because
  // Android frequently reports voices using 3-letter ISO 639-2/3 codes.
  const loadVoices = useCallback(async () => {
    if (voicesLoadedRef.current) return;
    voicesLoadedRef.current = true;
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      // Map our short codes to the prefixes we should accept on each platform.
      const PREFIXES: Record<string, string[]> = {
        en: ["en", "eng"],
        hi: ["hi", "hin"],
        ur: ["ur", "urd"],
      };
      const matchesFor = (lang: string) => {
        const prefixes = PREFIXES[lang] ?? [lang];
        return voices.filter((v) => {
          const code = (v.language || "").toLowerCase();
          return prefixes.some((p) => code.startsWith(p));
        });
      };
      const pickMaleId = (list: typeof voices): string | undefined => {
        if (list.length === 0) return undefined;
        const malePreferred = list.find((v) =>
          /male|rishi|rajeev|salman|aamir|asad|onyx|daniel|fred|alex/i.test(
            v.identifier + " " + ((v as { name?: string }).name ?? "")
          )
        );
        return (malePreferred ?? list[0]).identifier;
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
    } catch {
      // Voice listing not supported on this platform — proceed with defaults.
    }
  }, []);

  useEffect(() => { void loadVoices(); }, [loadVoices]);

  const stopSpeaking = useCallback(async () => {
    Speech.stop();
    setSpeakingId(null);
  }, []);

  // Speak a message via on-device TTS in the right language (English / Hindi / Urdu).
  // We use a deeper pitch and slightly slower rate to sound calm and scholarly.
  // If the picked voice fails (e.g. a stale cached id, or platform mismatch), we
  // retry once without the voice id and let the OS choose its default voice for
  // the locale. If the language itself isn't installed, we surface a one-time
  // alert telling the user how to install it instead of failing silently.
  const playWithQariVoice = useCallback(async (msg: ChatMsg) => {
    await stopSpeaking();
    await loadVoices();
    const lang = detectTtsLanguage(msg.content);
    const localeCode = lang === "hi" ? "hi-IN" : lang === "ur" ? "ur-PK" : "en-US";
    const supported = langSupportedRef.current[lang] ?? true;

    // No voice installed for this language → notify user once, then fall back
    // to default (will likely sound English-accented, but at least audible).
    if (!supported && !missingLangAlertedRef.current[lang]) {
      missingLangAlertedRef.current[lang] = true;
      const langName = lang === "hi" ? "Hindi" : lang === "ur" ? "Urdu" : "this language";
      const where = Platform.OS === "ios"
        ? "Settings → Accessibility → Spoken Content → Voices"
        : "Settings → System → Languages & input → Text-to-speech output";
      Alert.alert(
        `${langName} voice not installed`,
        `Your device doesn't have a ${langName} voice installed. To hear Noor AI in ${langName}, install one from: ${where}.`,
      );
    }

    setSpeakingId(msg.id);

    const speakWith = (voiceId: string | undefined, allowRetry: boolean) => {
      Speech.speak(msg.content, {
        language: localeCode,
        ...(voiceId ? { voice: voiceId } : {}),
        rate: 0.92,
        pitch: 0.88,
        onDone: () => setSpeakingId((cur) => (cur === msg.id ? null : cur)),
        onStopped: () => setSpeakingId((cur) => (cur === msg.id ? null : cur)),
        onError: () => {
          // Retry once without the voice id — the cached identifier may be invalid
          // on this device (e.g. user uninstalled the voice).
          if (allowRetry && voiceId) {
            speakWith(undefined, false);
          } else {
            setSpeakingId((cur) => (cur === msg.id ? null : cur));
          }
        },
      });
    };

    speakWith(voicesByLangRef.current[lang], true);
  }, [stopSpeaking, loadVoices]);

  const scrollToEnd = useCallback((delay = 120) => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), delay);
  }, []);

  const speakMessage = useCallback(async (msg: ChatMsg) => {
    if (speakingId === msg.id) {
      await stopSpeaking();
      return;
    }
    await playWithQariVoice(msg);
  }, [speakingId, stopSpeaking, playWithQariVoice]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");
    setShowSuggestions(false);
    Keyboard.dismiss();

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: msg,
      timestamp: Date.now(),
    };
    const aiId = `a-${Date.now() + 1}`;
    const aiMsg: ChatMsg = {
      id: aiId,
      role: "assistant",
      content: "",
      timestamp: Date.now() + 1,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setStreaming(true);
    scrollToEnd();

    let finalContent = "";

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const history = messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      await streamGuardianChat(
        {
          message: msg,
          history,
          identity: { provider, model: modelId, sect, subSchool, madhhab },
        },
        (delta) => {
          finalContent += delta;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, content: m.content + delta } : m))
          );
          scrollToEnd(60);
        },
        ctrl.signal
      );

      // Auto-speak every Noor AI response in the warm Qari-style voice
      if (finalContent.trim()) {
        playWithQariVoice({
          id: aiId,
          role: "assistant",
          content: finalContent,
          timestamp: Date.now(),
        }).catch(() => {});
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: "I couldn't connect right now. Please check your connection and try again." }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, madhhab, sect, subSchool, provider, modelId, playWithQariVoice]);

  if (isLoading || !isAuthenticated) return null;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const lastMsg = messages[messages.length - 1];
  const isWaiting = streaming && lastMsg?.role === "assistant" && lastMsg.content === "";

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={topPad + 60}
    >
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.replace("/mode-select")}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Image
          source={require("@/assets/images/noor/molana-avatar.jpg")}
          style={styles.headerLogo}
          resizeMode="cover"
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Noor AI</Text>
          <View style={styles.statusRow}>
            <View style={[styles.onlineDot, { backgroundColor: streaming ? "#fbbf24" : "#4ade80" }]} />
            <Text style={styles.statusText}>
              {streaming ? "Responding…" : "Digital Guardian · Online"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/call-noor")}
          style={({ pressed }) => [styles.headerRightBtn, { opacity: pressed ? 0.7 : 1, marginRight: 6 }]}
          hitSlop={8}
          accessibilityLabel="Call Noor (voice mode)"
        >
          <Feather name="phone" size={18} color="#fff" />
        </Pressable>
        <Pressable
          onPress={openPrefs}
          style={({ pressed }) => [styles.headerRightBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={8}
          accessibilityLabel="Preferences"
        >
          <Feather name="settings" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={[styles.chatContent, { paddingBottom: botPad + 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isSpeaking = speakingId === msg.id;
          return (
            <View key={msg.id} style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
              <View
                style={[
                  styles.bubble,
                  isUser
                    ? [styles.bubbleUser, { backgroundColor: colors.primary }]
                    : [styles.bubbleAi, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
              >
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
                        color={isSpeaking ? colors.primary : colors.mutedForeground}
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
                style={({ pressed }) => [
                  styles.suggestionChip,
                  { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => sendMessage(s)}
              >
                <Text style={[styles.suggestionText, { color: colors.primary }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={styles.inputOuter}>
          <View style={[styles.inputRow, { backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Ask Noor AI…"
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              returnKeyType="default"
              editable={!streaming}
              underlineColorAndroid="transparent"
              selectionColor={colors.primary}
              cursorColor={colors.primary}
            />
          </View>
          <View
            pointerEvents="none"
            style={[styles.inputBorder, { borderColor: streaming ? colors.primary : colors.border }]}
          />
        </View>
        <VoiceRecorder
          onTranscript={(text) => {
            setInput(text);
            sendMessage(text);
          }}
          onBeforeRecord={() => {
            stopSpeaking();
          }}
          disabled={streaming}
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: input.trim() && !streaming ? colors.primary : colors.mutedForeground + "44" }]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || streaming}
        >
          <Feather name="send" size={18} color={input.trim() && !streaming ? "#fff" : colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Preferences modal — pick School of Thought (Madhhab) */}
      <Modal
        visible={prefsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPrefsOpen(false)}
      >
        <Pressable style={styles.prefsBackdrop} onPress={() => madhhab && setPrefsOpen(false)}>
          <Pressable style={[styles.prefsCard, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.prefsHeader}>
              <Text style={[styles.prefsTitle, { color: colors.foreground }]}>Preferences</Text>
              <Pressable onPress={() => madhhab && setPrefsOpen(false)} hitSlop={8} disabled={!madhhab}>
                <Feather name="x" size={22} color={madhhab ? colors.mutedForeground : "transparent"} />
              </Pressable>
            </View>

            <Text style={[styles.prefsLabel, { color: colors.mutedForeground }]}>SCHOOL OF THOUGHT (MADHHAB)</Text>

            <View style={styles.prefsGrid}>
              {MADHHABS.map((m) => {
                const active = draftMadhhab === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => { setDraftMadhhab(m); Haptics.selectionAsync(); }}
                    style={({ pressed }) => [
                      styles.prefsTile,
                      {
                        backgroundColor: active ? colors.secondary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.prefsTileText,
                        { color: active ? colors.primary : colors.foreground, fontWeight: active ? "700" : "600" },
                      ]}
                    >
                      {m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={savePrefs}
              style={({ pressed }) => [
                styles.prefsSaveBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={styles.prefsSaveText}>Save & Continue</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: { width: 36, height: 36, borderRadius: 18 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "500" },
  headerRightBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  prefsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  prefsCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 22,
    padding: 22,
  },
  prefsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  prefsTitle: { fontSize: 20, fontWeight: "800" },
  prefsLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  prefsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  prefsTile: {
    flexBasis: "48%",
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "flex-start",
  },
  prefsTileText: { fontSize: 15 },
  prefsSaveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  prefsSaveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 14, paddingTop: 12 },
  bubbleRow: { marginBottom: 10 },
  bubbleRowUser: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAi: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleMeta: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 4 },
  bubbleTime: { fontSize: 10, fontWeight: "500" },
  suggestionsBox: { paddingVertical: 8, gap: 8, alignItems: "center" },
  suggestionChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  suggestionText: { fontSize: 13, fontWeight: "500" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  inputOuter: { flex: 1, position: "relative" },
  inputRow: {
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  inputBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  input: {
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
