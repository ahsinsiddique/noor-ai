import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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

import { SurahPickerModal } from "@/components/SurahPickerModal";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useSessions } from "@/contexts/SessionContext";
import { useTeacher } from "@/contexts/TeacherContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMadhhab } from "@/contexts/MadhhabContext";
import { useModel } from "@/contexts/ModelContext";
import { useSect } from "@/contexts/SectContext";
import { surahs as staticSurahs } from "@/data/quran";
import { useColors } from "@/hooks/useColors";
import { useAyah, useSurahList } from "@/services/quranApi";
import { type ChatContext, streamChat } from "@/services/aiService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const AUTOPLAY_KEY = "@quran_tutor_autoplay";
const TRANSLATION_KEY = "@quran_tutor_translation";

const TRANSLATION_LANGS = [
  { code: "en", edition: "en.asad", label: "English", flag: "🇬🇧" },
  { code: "ur", edition: "ur.maududi", label: "اردو", flag: "🇵🇰" },
  { code: "fr", edition: "fr.hamidullah", label: "Français", flag: "🇫🇷" },
  { code: "tr", edition: "tr.diyanet", label: "Türkçe", flag: "🇹🇷" },
  { code: "id", edition: "id.indonesian", label: "Indonesia", flag: "🇮🇩" },
  { code: "de", edition: "de.bubenheim", label: "Deutsch", flag: "🇩🇪" },
] as const;

// ─── Animated typing dots (WhatsApp-style) ───────────────────────────────────

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

// ─── Suggested questions ─────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What does this ayah mean?",
  "Explain this in simple words",
  "What is the context of this ayah?",
  "How should I recite this correctly?",
];

// ─── Memoized message bubble — prevents N re-renders during streaming ─────────

interface MsgBubbleProps {
  msg: ChatMsg;
  prevTimestamp: number | undefined;
  isLast: boolean;
  isWaiting: boolean;
  isSpeaking: boolean;
  teacherEmoji: string;
  teacherColor: string;
  accentColor: string;
  primaryColor: string;
  cardColor: string;
  borderColor: string;
  foregroundColor: string;
  mutedColor: string;
  onSpeak: (msg: ChatMsg) => void;
}

const MessageBubble = React.memo(function MessageBubble({
  msg, prevTimestamp, isLast, isWaiting, isSpeaking,
  teacherEmoji, teacherColor, accentColor,
  primaryColor, cardColor, borderColor, foregroundColor, mutedColor,
  onSpeak,
}: MsgBubbleProps) {
  const isUser = msg.role === "user";
  const showTime = !prevTimestamp || msg.timestamp - prevTimestamp > 5 * 60 * 1000;

  return (
    <React.Fragment>
      {showTime && (
        <Text style={[styles.timeStamp, { color: mutedColor }]}>
          {formatTime(msg.timestamp)}
        </Text>
      )}
      <View style={[styles.bubbleRow, isUser ? styles.rowRight : styles.rowLeft]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: teacherColor }]}>
            <Text style={styles.avatarIcon}>{teacherEmoji}</Text>
          </View>
        )}
        <View style={[styles.bubbleWrap, isUser ? styles.wrapRight : styles.wrapLeft]}>
          <View style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: primaryColor }]
              : [styles.bubbleAI, { backgroundColor: cardColor, borderColor }],
          ]}>
            {isWaiting && isLast ? (
              <TypingDots color={primaryColor} />
            ) : msg.content ? (
              <Text style={[styles.bubbleText, { color: isUser ? "#fff" : foregroundColor }]}>
                {msg.content}
              </Text>
            ) : (
              <ActivityIndicator size="small" color={primaryColor} style={{ margin: 4 }} />
            )}
          </View>
          <View style={[styles.bubbleFooter, isUser ? styles.footerRight : styles.footerLeft]}>
            {!isUser && msg.content && (
              <Pressable
                onPress={() => onSpeak(msg)}
                style={[styles.ttsBtn, { backgroundColor: isSpeaking ? teacherColor : cardColor }]}
              >
                <Feather name={isSpeaking ? "volume-x" : "volume-2"} size={11} color={isSpeaking ? "#fff" : primaryColor} />
                <Text style={[styles.ttsBtnText, { color: isSpeaking ? "#fff" : primaryColor }]}>
                  {isSpeaking ? "Stop" : "Listen"}
                </Text>
              </Pressable>
            )}
            <Text style={[styles.msgTime, { color: mutedColor }]}>
              {formatTime(msg.timestamp)}{isUser && "  ✓✓"}
            </Text>
          </View>
        </View>
        {isUser && (
          <View style={[styles.avatar, { backgroundColor: accentColor }]}>
            <Feather name="user" size={13} color="#fff" />
          </View>
        )}
      </View>
    </React.Fragment>
  );
}, (prev, next) =>
  prev.msg.content === next.msg.content &&
  prev.isLast === next.isLast &&
  prev.isWaiting === next.isWaiting &&
  prev.isSpeaking === next.isSpeaking &&
  prev.teacherColor === next.teacherColor
);

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LessonScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { teacher } = useTeacher();
  const { madhhab } = useMadhhab();
  const { sect, subSchool } = useSect();
  const { provider, modelId } = useModel();
  const { startSession, addMessage: addSessionMessage, currentSession } = useSessions();

  // ─── Navigation state (surah + ayah identifiers) ─────────────────────
  const [surahId, setSurahId] = useState(1);
  const [ayahNumber, setAyahNumber] = useState(1);
  const [showPicker, setShowPicker] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [showAyah, setShowAyah] = useState(true);
  const [translationEdition, setTranslationEdition] = useState("en.asad");

  // ─── Chat state ───────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<TextInput>(null);
  const prevAyahRef = useRef<string>("");
  const voiceTriggeredRef = useRef(false);
  // Always-current messages ref — lets sendMessage read latest messages without
  // being in its dep array (which would recreate it on every streaming delta).
  const messagesRef = useRef<ChatMsg[]>([]);
  messagesRef.current = messages;

  // ─── Live API data ────────────────────────────────────────────────────
  const { data: surahList } = useSurahList();
  const { data: liveAyah, isLoading: ayahLoading, error: ayahError } = useAyah(surahId, ayahNumber, translationEdition);

  // Resolve ayah data (live first, static fallback)
  const staticFallback = useMemo(() => {
    const s = staticSurahs.find((s) => s.id === surahId);
    const a = s?.ayahs.find((a) => a.number === ayahNumber);
    if (s && a) {
      return {
        arabic: a.arabic,
        translation: a.translation,
        numberInSurah: a.number,
        globalNumber: 0,
        surahName: s.name,
        surahArabic: s.arabicName,
        totalAyahs: s.totalAyahs,
        audioUrl: "",
      };
    }
    return null;
  }, [surahId, ayahNumber]);

  const ayah = liveAyah ?? staticFallback;
  const surahMeta = surahList?.find((s) => s.number === surahId);
  const surahName = surahMeta?.englishName ?? ayah?.surahName ?? "Surah";
  const totalAyahs = surahMeta?.numberOfAyahs ?? ayah?.totalAyahs ?? 7;

  // ─── Audio player for recitation (web + native via CDN audio) ───────────
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!ayah) return;
    const key = `${surahId}-${ayahNumber}`;
    if (prevAyahRef.current === key) return;
    prevAyahRef.current = key;
  }, [ayah?.arabic, surahId, ayahNumber]);

  // Load autoplay + translation preferences
  useEffect(() => {
    AsyncStorage.multiGet([AUTOPLAY_KEY, TRANSLATION_KEY])
      .then(([[, autoVal], [, transVal]]) => {
        if (autoVal !== null) setAutoPlay(autoVal === "true");
        if (transVal) setTranslationEdition(transVal);
      })
      .catch(() => { });
  }, []);

  const toggleAutoPlay = useCallback(() => {
    const next = !autoPlay;
    setAutoPlay(next);
    AsyncStorage.setItem(AUTOPLAY_KEY, String(next)).catch(() => { });
    if (!next) {
      try { player.pause(); } catch { }
      Speech.stop();
      setSpeakingId(null);
    }
    Haptics.selectionAsync();
  }, [autoPlay, player]);

  // ─── Session init ─────────────────────────────────────────────────────
  useEffect(() => {
    startSession(surahName, ayahNumber);
    return () => {
      abortRef.current?.abort();
      Speech.stop();
      try { player.pause(); } catch { }
    };
  }, []);

  // Update welcome message when ayah data loads
  useEffect(() => {
    if (!ayah) return;
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Bismillah! 🌿\n\nWelcome! I'm your ${teacher.name} ${teacher.emoji}\n\n${teacher.arabicTitle}\n\nWe're studying Surah ${surahName}, Ayah ${ayah.numberInSurah}. Ask me anything about this ayah — its meaning, context, Arabic, or how to apply it in your life.`,
        timestamp: Date.now(),
      },
    ]);
  }, [ayah?.numberInSurah, surahId]);

  const scrollToEnd = useCallback((delay = 120) => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), delay);
  }, []);

  // ─── TTS (manual Listen button on AI bubbles) ─────────────────────────

  const speakMessage = useCallback(async (msg: ChatMsg) => {
    if (speakingId === msg.id) {
      await Speech.stop();
      setSpeakingId(null);
      return;
    }
    await Speech.stop();
    setSpeakingId(msg.id);
    Speech.speak(msg.content, {
      language: "en-US",
      rate: teacher.ttsRate,
      pitch: teacher.ttsPitch,
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }, [speakingId, teacher.ttsRate, teacher.ttsPitch]);

  // Stable ref so MessageBubble.onSpeak never changes identity — prevents
  // all bubbles re-rendering when speakingId changes.
  const speakRef = useRef(speakMessage);
  speakRef.current = speakMessage;
  const handleSpeak = useCallback((msg: ChatMsg) => speakRef.current(msg), []);

  // ─── Recite ayah button (Arabic audio + English TTS) ─────────────────

  const isRecitePlaying = playerStatus.playing;

  const handleRecite = useCallback(() => {
    if (!ayah) return;
    try {
      if (liveAyah?.audioUrl) {
        // Both web and native: CDN Arabic recitation audio
        if (isRecitePlaying) {
          player.pause();
        } else {
          // Stop any TTS before playing CDN audio
          Speech.stop();
          setSpeakingId(null);
          player.replace({ uri: liveAyah.audioUrl });
          setTimeout(() => { try { player.play(); } catch { } }, 150);
        }
      } else {
        // Fallback: expo-speech Arabic (when audio URL not yet loaded)
        const isSpeaking = !!speakingId?.startsWith("recite-");
        if (isSpeaking) {
          Speech.stop();
          setSpeakingId(null);
        } else {
          setSpeakingId("recite-arabic");
          Speech.speak(ayah.arabic, {
            language: "ar",
            rate: 0.7,
            onDone: () => setSpeakingId(null),
            onStopped: () => setSpeakingId(null),
            onError: () => setSpeakingId(null),
          });
        }
      }
    } catch { }
  }, [isRecitePlaying, player, liveAyah?.audioUrl, ayah, speakingId]);

  // ─── Send message ─────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    if (!ayah) return;
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");
    setShowSuggestions(false);
    Keyboard.dismiss();

    const sessionId = currentSession?.id ?? "";
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
    if (sessionId) addSessionMessage(sessionId, { role: "user", content: msg });
    setStreaming(true);
    scrollToEnd();

    let finalContent = "";

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const context: ChatContext = {
        surahName: surahName,
        surahArabic: ayah.surahArabic,
        ayahNumber: ayah.numberInSurah,
        ayahArabic: ayah.arabic,
        ayahTranslation: ayah.translation,
        userLevel: user?.level ?? "Beginner",
      };

      const history = messagesRef.current.map((m) => ({ role: m.role, content: m.content }));

      await streamChat(
        {
          message: msg,
          context,
          teacherPrompt: teacher.systemPrompt,
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

      if (sessionId && finalContent.trim()) {
        addSessionMessage(sessionId, { role: "assistant", content: finalContent });
      }

      const shouldSpeak = autoPlay || voiceTriggeredRef.current;
      voiceTriggeredRef.current = false;
      if (shouldSpeak && finalContent.trim()) {
        try { player.pause(); } catch { }
        setSpeakingId(aiId);
        Speech.speak(finalContent, {
          language: "en-US",
          rate: teacher.ttsRate,
          pitch: teacher.ttsPitch,
          onDone: () => setSpeakingId(null),
          onStopped: () => setSpeakingId(null),
          onError: () => setSpeakingId(null),
        });
      }
    } catch (err: unknown) {
      console.error("streamChat error:", err);
      voiceTriggeredRef.current = false;
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
  }, [input, streaming, ayah, surahName, user?.level, autoPlay, teacher, currentSession, addSessionMessage]);

  // ─── Ayah navigation ──────────────────────────────────────────────────

  const nextAyah = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prevAyahRef.current = "";
    if (ayahNumber < totalAyahs) {
      setAyahNumber(ayahNumber + 1);
    } else {
      // Move to next surah
      const nextSurahNum = surahId < 114 ? surahId + 1 : surahId;
      if (nextSurahNum !== surahId) {
        setSurahId(nextSurahNum);
        setAyahNumber(1);
      }
    }
    setMessages([]);
    setShowSuggestions(true);
  }, [ayahNumber, totalAyahs, surahId]);

  const prevAyah = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prevAyahRef.current = "";
    if (ayahNumber > 1) {
      setAyahNumber(ayahNumber - 1);
    } else if (surahId > 1) {
      const prevSurahMeta = surahList?.find((s) => s.number === surahId - 1);
      setSurahId(surahId - 1);
      setAyahNumber(prevSurahMeta?.numberOfAyahs ?? 7);
    }
    setMessages([]);
    setShowSuggestions(true);
  }, [ayahNumber, surahId, surahList]);

  const handleSurahSelect = useCallback((id: number) => {
    prevAyahRef.current = "";
    setSurahId(id);
    setAyahNumber(1);
    setMessages([]);
    setShowSuggestions(true);
    setShowPicker(false);
  }, []);

  const finishSession = useCallback(() => {
    Speech.stop();
    try { player.pause(); } catch { }
    router.push("/quiz");
  }, [player]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 84 : 0);

  const lastMsg = messages[messages.length - 1];
  const isWaiting = streaming && lastMsg?.role === "assistant" && lastMsg.content === "";

  return (
    <>
      <SurahPickerModal
        visible={showPicker}
        currentSurah={surahId}
        onSelect={handleSurahSelect}
        onClose={() => setShowPicker(false)}
      />

      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={topPad + 60}
      >
        {/* ─── Header ─── */}
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 12 }]}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.headerAvatar} onPress={() => setShowPicker(true)}>
              <Text style={styles.headerAvatarIcon}>{teacher.emoji}</Text>
            </Pressable>
            <View>
              <Pressable onPress={() => setShowPicker(true)} style={styles.surahNameBtn}>
                <Text style={styles.headerName} numberOfLines={1}>{surahName}</Text>
                <Feather name="chevron-down" size={13} color="rgba(255,255,255,0.75)" />
              </Pressable>
              <View style={styles.headerStatusRow}>
                <View style={[styles.onlineDot, { backgroundColor: streaming ? colors.accent : "#4ade80" }]} />
                <Text style={styles.headerStatus}>
                  {streaming ? "Responding…" : `${teacher.name} · Online`}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              style={[styles.autoPlayBtn, { backgroundColor: autoPlay ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)" }]}
              onPress={toggleAutoPlay}
              accessibilityLabel={`Autoplay is ${autoPlay ? "on" : "off"}`}
            >
              <Feather name={autoPlay ? "volume-2" : "volume-x"} size={14} color="#fff" />
            </Pressable>
            <Pressable style={styles.quizBtn} onPress={finishSession}>
              <Text style={styles.quizBtnText}>Quiz</Text>
              <Feather name="chevron-right" size={14} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* ─── Ayah card ─── */}
        <View style={[styles.ayahCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.ayahNavRow}>
            <Pressable
              style={[styles.navBtn, { backgroundColor: colors.secondary, opacity: surahId === 1 && ayahNumber === 1 ? 0.4 : 1 }]}
              onPress={prevAyah}
              disabled={surahId === 1 && ayahNumber === 1}
            >
              <Feather name="chevron-left" size={18} color={colors.primary} />
            </Pressable>

            <Pressable style={styles.ayahCardCenter} onPress={() => setShowPicker(true)}>
              <Text style={[styles.ayahSurahName, { color: colors.primary }]}>{surahName}</Text>
              <Text style={[styles.ayahProgress, { color: colors.mutedForeground }]}>
                {ayahLoading ? "Loading…" : `Ayah ${ayah?.numberInSurah ?? ayahNumber} of ${totalAyahs}`}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.navBtn, { backgroundColor: colors.secondary }]}
              onPress={nextAyah}
            >
              <Feather name="chevron-right" size={18} color={colors.primary} />
            </Pressable>
          </View>

          {showAyah && (
            <View style={[styles.ayahBody, { borderTopColor: colors.border }]}>
              {ayahLoading && !ayah ? (
                <View style={styles.ayahLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.ayahLoadingText, { color: colors.mutedForeground }]}>Loading ayah…</Text>
                </View>
              ) : ayah ? (
                <>
                  <Text style={[styles.ayahArabic, { color: colors.foreground }]}>
                    {ayah.arabic}
                  </Text>

                  {/* Language picker */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.langPicker}
                    contentContainerStyle={styles.langPickerContent}
                  >
                    {TRANSLATION_LANGS.map((lang) => {
                      const active = translationEdition === lang.edition;
                      return (
                        <Pressable
                          key={lang.code}
                          onPress={() => {
                            setTranslationEdition(lang.edition);
                            AsyncStorage.setItem(TRANSLATION_KEY, lang.edition).catch(() => { });
                            Haptics.selectionAsync();
                          }}
                          style={[
                            styles.langChip,
                            { backgroundColor: active ? colors.primary : colors.secondary, borderColor: active ? colors.primary : colors.border },
                          ]}
                        >
                          <Text style={styles.langFlag}>{lang.flag}</Text>
                          <Text style={[styles.langCode, { color: active ? "#fff" : colors.mutedForeground }]}>
                            {lang.code.toUpperCase()}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {ayahLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 6 }} />
                  ) : (
                    <Text style={[styles.ayahTranslation, { color: colors.mutedForeground }]}>
                      {ayah.translation}
                    </Text>
                  )}

                  {/* Recite button */}
                  {(() => {
                    const active = liveAyah?.audioUrl ? isRecitePlaying : !!speakingId?.startsWith("recite-");
                    return (
                      <Pressable
                        style={[
                          styles.reciteBtn,
                          { backgroundColor: active ? colors.primary : colors.secondary, borderColor: colors.primary },
                        ]}
                        onPress={handleRecite}
                      >
                        <Feather
                          name={active ? "pause-circle" : "play-circle"}
                          size={15}
                          color={active ? "#fff" : colors.primary}
                        />
                        <Text style={[styles.reciteBtnText, { color: active ? "#fff" : colors.primary }]}>
                          {active ? "Pause Recitation" : "Recite Ayah"}
                        </Text>
                      </Pressable>
                    );
                  })()}
                </>
              ) : ayahError ? (
                <Text style={[styles.ayahError, { color: colors.mutedForeground }]}>
                  Could not load ayah — check connection
                </Text>
              ) : null}
            </View>
          )}

          <Pressable onPress={() => setShowAyah((v) => !v)} style={styles.toggleBtn}>
            <Feather name={showAyah ? "chevron-up" : "chevron-down"} size={13} color={colors.primary} />
            <Text style={[styles.toggleText, { color: colors.primary }]}>
              {showAyah ? "Hide" : "Show ayah"}
            </Text>
          </Pressable>
        </View>

        {/* ─── Chat messages ─── */}
        <ScrollView
          ref={scrollRef}
          style={[styles.chatScroll, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              prevTimestamp={messages[idx - 1]?.timestamp}
              isLast={msg.id === lastMsg?.id}
              isWaiting={isWaiting}
              isSpeaking={speakingId === msg.id}
              teacherEmoji={teacher.emoji}
              teacherColor={teacher.color}
              accentColor={colors.accent ?? "#f59e0b"}
              primaryColor={colors.primary}
              cardColor={colors.card}
              borderColor={colors.border}
              foregroundColor={colors.foreground}
              mutedColor={colors.mutedForeground}
              onSpeak={handleSpeak}
            />
          ))}

          {isWaiting && (
            <View style={[styles.bubbleRow, styles.rowLeft]}>
              <View style={[styles.avatar, { backgroundColor: teacher.color }]}>
                <Text style={styles.avatarIcon}>{teacher.emoji}</Text>
              </View>
              <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TypingDots color={colors.primary} />
              </View>
            </View>
          )}

          {showSuggestions && messages.length <= 1 && !streaming && (
            <View style={styles.suggestionsWrap}>
              <Text style={[styles.suggestionsLabel, { color: colors.mutedForeground }]}>
                Suggested questions
              </Text>
              <View style={styles.suggestionsRow}>
                {SUGGESTIONS.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => sendMessage(q)}
                    style={({ pressed }) => [
                      styles.suggestionChip,
                      { backgroundColor: colors.card, borderColor: colors.primary, opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Text style={[styles.suggestionText, { color: colors.primary }]}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* ─── Input bar ─── */}
        <View
          style={[
            styles.inputBar,
            { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: botPad + 12 },
          ]}
        >
          <View style={styles.inputOuter}>
            <View style={[styles.inputRow, { backgroundColor: colors.background }]}>
              <TextInput
                ref={inputRef}
                style={[styles.textInput, { color: colors.foreground }]}
                placeholder="Ask about this ayah…"
                placeholderTextColor={colors.mutedForeground}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={600}
                onSubmitEditing={() => sendMessage()}
                editable={!streaming}
                returnKeyType="send"
                blurOnSubmit={false}
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
              voiceTriggeredRef.current = true;
              setInput(text);
              sendMessage(text);
            }}
            onBeforeRecord={() => {
              // Release the audio session before recording starts so iOS
              // doesn't block prepareToRecordAsync with a session conflict.
              try { player.pause(); } catch { }
              Speech.stop();
              setSpeakingId(null);
            }}
            disabled={streaming}
          />
          <Pressable
            style={[
              styles.sendBtn,
              { backgroundColor: colors.primary, opacity: !input.trim() || streaming ? 0.4 : 1 },
            ]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || streaming}
          >
            {streaming
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="send" size={18} color="#fff" />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarIcon: { fontSize: 18 },
  surahNameBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerName: { fontSize: 15, fontWeight: "700", color: "#fff", maxWidth: 140 },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  headerStatus: { fontSize: 11, fontWeight: "400", color: "rgba(255,255,255,0.75)" },
  autoPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  quizBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  quizBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  // Ayah card
  ayahCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  ayahNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  ayahCardCenter: { alignItems: "center", flex: 1 },
  ayahSurahName: { fontSize: 14, fontWeight: "700" },
  ayahProgress: { fontSize: 12, fontWeight: "400", marginTop: 1 },
  ayahBody: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  ayahLoading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  ayahLoadingText: { fontSize: 13 },
  ayahError: { fontSize: 13, textAlign: "center", paddingVertical: 12 },
  ayahArabic: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 42,
    marginBottom: 8,
  },
  ayahTranslation: { fontSize: 13, fontWeight: "400", lineHeight: 20, marginBottom: 10 },
  reciteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 2,
  },
  reciteBtnText: { fontSize: 12, fontWeight: "600" },
  langPicker: { marginBottom: 8 },
  langPickerContent: { flexDirection: "row", gap: 6, paddingVertical: 2 },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  langFlag: { fontSize: 13 },
  langCode: { fontSize: 10, fontWeight: "700" },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
  },
  toggleText: { fontSize: 12, fontWeight: "500" },

  // Chat
  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  timeStamp: {
    alignSelf: "center",
    fontSize: 11,
    fontWeight: "400",
    marginVertical: 8,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 2,
    alignItems: "flex-end",
    gap: 8,
  },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  avatarIcon: { fontSize: 13 },
  bubbleWrap: { maxWidth: "74%" },
  wrapLeft: {},
  wrapRight: {},
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minHeight: 36,
    justifyContent: "center",
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bubbleFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 10 },
  footerLeft: { justifyContent: "flex-start" },
  footerRight: { justifyContent: "flex-end" },
  ttsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ttsBtnText: { fontSize: 11, fontWeight: "600" },
  msgTime: { fontSize: 11, fontWeight: "400" },

  // Suggestions
  suggestionsWrap: { marginTop: 10, marginBottom: 6 },
  suggestionsLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, textAlign: "center" },
  suggestionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionText: { fontSize: 13, fontWeight: "500" },

  // Input
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  inputOuter: { flex: 1, position: "relative" },
  inputRow: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 130,
  },
  inputBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  textInput: { flex: 1, fontSize: 15, fontWeight: "400", lineHeight: 22, minWidth: 0 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
