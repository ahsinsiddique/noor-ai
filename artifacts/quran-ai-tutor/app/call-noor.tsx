import { AudioModule } from "expo-audio";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScholarAvatar, type AvatarState } from "@/components/ScholarAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { useMadhhab } from "@/contexts/MadhhabContext";
import { useModel } from "@/contexts/ModelContext";
import { useSect } from "@/contexts/SectContext";
import { useColors } from "@/hooks/useColors";
import { useVoiceTurn } from "@/hooks/useVoiceTurn";
import { streamGuardianChat } from "@/services/aiService";

/**
 * Call Noor — hands-free phone-call-style experience for Noor AI Scholar.
 *
 * Voice pipeline delegated to useVoiceTurn:
 *   idle → record → Whisper transcription → onTranscript callback
 *   onTranscript → AI stream → speakText (TTS) → idle
 */

type CallState = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

const WINDOW_HEIGHT = Dimensions.get("window").height;

interface Turn {
  role: "user" | "assistant";
  content: string;
}

// ─── Full-text popup ──────────────────────────────────────────────────────────
function TranscriptModal({
  visible,
  label,
  text,
  onClose,
}: {
  visible: boolean;
  label: string;
  text: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable style={modalStyles.sheet} onPress={() => {}}>
          <Text style={modalStyles.label}>{label}</Text>
          <ScrollView
            style={[modalStyles.scroll, { maxHeight: WINDOW_HEIGHT * 0.5 }]}
            contentContainerStyle={{ paddingBottom: 4 }}
            showsVerticalScrollIndicator
            bounces
          >
            <Text style={modalStyles.body} selectable>{text}</Text>
          </ScrollView>
          <Pressable style={modalStyles.closeBtn} onPress={onClose}>
            <Text style={modalStyles.closeTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "75%",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#888",
    marginBottom: 12,
  },
  scroll: { marginBottom: 16 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 26, color: "#111" },
  closeBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 32,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
  },
  closeTxt: { fontSize: 14, fontWeight: "600", color: "#333" },
});

export default function CallNoorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { madhhab } = useMadhhab();
  const { sect, subSchool } = useSect();
  const { provider, modelId, providerMeta, modelMeta } = useModel();

  const [error, setError] = useState<string | null>(null);
  const [lastUserSaid, setLastUserSaid] = useState<string>("");
  const [lastAiSaid, setLastAiSaid] = useState<string>("");
  const [forceLang, setForceLang] = useState<"ur" | "ar" | null>(null);
  const [modal, setModal] = useState<{ label: string; text: string } | null>(null);
  const [thinking, setThinking] = useState(false);

  const historyRef = useRef<Turn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── Transcript handler (called by useVoiceTurn after Whisper) ───────────
  // Stored in a ref so useVoiceTurn always gets the latest version without
  // needing it in the hook's dependency array.
  const handleTranscriptRef = useRef<(t: string) => void>(() => {});

  const { state: voiceState, seconds, clearError, startRecording, endTurn, speakText, stopSpeaking } = useVoiceTurn({
    forceLang,
    onTranscript: (t) => handleTranscriptRef.current(t),
    onError: setError,
  });

  // Assign every render — captures fresh closures (speakText, forceLang, etc.)
  // without adding them as hook dependencies.
  handleTranscriptRef.current = async (transcript: string) => {
    setLastUserSaid(transcript);
    setThinking(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const langCues: Record<string, string> = {
      ur: "[IMPORTANT: Reply ONLY in Urdu script (اردو). Do not use English or Roman Urdu.]\n",
      ar: "[IMPORTANT: Reply ONLY in Arabic script (العربية). Do not use English.]\n",
    };
    const messageForAI = forceLang ? langCues[forceLang] + transcript : transcript;

    let aiText = "";
    try {
      await streamGuardianChat(
        {
          message: messageForAI,
          history: historyRef.current,
          voiceMode: true,
          identity: { provider, model: modelId, sect, subSchool, madhhab },
        },
        (delta) => {
          aiText += delta;
          setLastAiSaid(aiText);
        },
        ctrl.signal,
      );
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setThinking(false);
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      setError(`AI error: ${msg}`);
      setThinking(false);
      return;
    }

    setThinking(false);

    if (!aiText.trim()) {
      setError("No response from AI — is Ollama running?");
      return;
    }

    historyRef.current = [
      ...historyRef.current,
      { role: "user" as const, content: transcript },
      { role: "assistant" as const, content: aiText },
    ].slice(-20);

    speakText(aiText);
  };

  // Combined UI state
  const callState: CallState = thinking ? "thinking" : voiceState;

  // ─── Pulse animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (callState === "recording") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
    } else if (callState === "speaking") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [callState]);

  // ─── Request mic permission on mount (native only) ─────────────────────────
  useEffect(() => {
    if (Platform.OS === "web") return;
    AudioModule.requestRecordingPermissionsAsync().then(({ granted }) => {
      if (!granted) {
        Alert.alert(
          "Microphone needed",
          "Call Noor needs your microphone. Please grant permission in system settings.",
        );
      }
    });
  }, []);

  // ─── Single orb handles every state ───────────────────────────────────────
  const handleOrbPress = useCallback(() => {
    switch (callState) {
      case "idle":
        void startRecording();
        return;
      case "recording":
        void endTurn();
        return;
      case "speaking":
        stopSpeaking();
        void startRecording();
        return;
      default:
        return;
    }
  }, [callState, startRecording, endTurn, stopSpeaking]);

  // ─── Hang up ───────────────────────────────────────────────────────────────
  const hangUp = useCallback(() => {
    abortRef.current?.abort();
    stopSpeaking();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    router.back();
  }, [stopSpeaking]);

  // ─── UI helpers ────────────────────────────────────────────────────────────
  const statusLabel = (() => {
    switch (callState) {
      case "idle": return "Tap the orb to speak";
      case "recording": return `Listening… ${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
      case "transcribing": return "Transcribing…";
      case "thinking": return "Noor is thinking…";
      case "speaking": return "Noor is speaking — tap to interrupt";
    }
  })();

  const orbColor = (() => {
    switch (callState) {
      case "recording": return "#ef4444";
      case "speaking": return colors.accent ?? "#f59e0b";
      case "transcribing":
      case "thinking": return colors.mutedForeground;
      default: return colors.primary;
    }
  })();

  const orbIcon: keyof typeof Feather.glyphMap =
    callState === "recording" ? "square" :
    callState === "speaking" ? "volume-2" :
    callState === "transcribing" || callState === "thinking" ? "loader" :
    "mic";

  const topPad = insets.top + 12;
  const botPad = insets.bottom + 24;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={hangUp} style={styles.headerBtn} hitSlop={10}>
          <Feather name="chevron-down" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Call Noor</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {providerMeta.name} · {modelMeta.name}
          </Text>
        </View>
        {/* Language toggle: auto → ur → ar → auto */}
        <Pressable
          style={[styles.headerBtn, styles.langToggle, {
            backgroundColor: forceLang ? colors.primary : colors.secondary,
          }]}
          onPress={() => setForceLang((l) => l === null ? "ur" : l === "ur" ? "ar" : null)}
          hitSlop={10}
          accessibilityLabel={`Language: ${forceLang ?? "auto"}`}
        >
          <Text style={[styles.langToggleText, { color: forceLang ? "#fff" : colors.mutedForeground }]}>
            {forceLang === "ur" ? "اردو" : forceLang === "ar" ? "عربي" : "Auto"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.headerBtn, { marginLeft: 4 }]}
          onPress={() => router.push("/profile")}
          hitSlop={10}
          accessibilityLabel="Settings"
        >
          <Feather name="settings" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Caller identity */}
      <View style={styles.callerArea}>
        <Text style={[styles.callerName, { color: colors.foreground }]}>Noor AI</Text>
        <Text style={[styles.callerRole, { color: colors.mutedForeground }]}>
          Digital Guardian · Online
        </Text>
      </View>

      {/* Avatar */}
      <View style={styles.avatarArea}>
        <ScholarAvatar
          state={
            callState === "recording" || callState === "transcribing"
              ? "listening"
              : (callState as AvatarState)
          }
          variant="portrait"
          size={300}
        />
        <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>{statusLabel}</Text>
      </View>

      {/* Mic pill */}
      <View style={styles.micArea}>
        <Pressable
          style={({ pressed }) => [
            styles.micPill,
            { backgroundColor: orbColor, opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={handleOrbPress}
          disabled={callState === "transcribing" || callState === "thinking"}
          accessibilityLabel={statusLabel}
        >
          <Feather name={orbIcon} size={22} color="#fff" />
          <Text style={styles.micPillText}>
            {callState === "idle" ? "Tap to speak" :
             callState === "recording" ? "Tap to send" :
             callState === "speaking" ? "Tap to interrupt" : "…"}
          </Text>
        </Pressable>
      </View>

      {/* Error banner */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={13} color="#ef4444" />
          <Text style={styles.errorBannerText} numberOfLines={3}>{error}</Text>
          <Pressable onPress={() => { setError(null); clearError(); }} hitSlop={8}>
            <Feather name="x" size={13} color="#ef4444" />
          </Pressable>
        </View>
      )}

      {/* Transcript preview */}
      <View style={styles.transcript}>
        {lastUserSaid ? (
          <Pressable onPress={() => setModal({ label: "You said", text: lastUserSaid })}>
            <Text style={[styles.transcriptLabel, { color: colors.mutedForeground }]}>
              You said  <Text style={{ fontSize: 10 }}>↗</Text>
            </Text>
            <Text style={[styles.transcriptBody, { color: colors.foreground }]} numberOfLines={2}>
              {lastUserSaid}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.transcriptHint, { color: colors.mutedForeground }]}>
            Assalamu Alaikum{user?.name ? `, ${user.name}` : ""}. Ask Noor anything —
            about Islam, daily guidance, duas, or this week's reflections.
          </Text>
        )}
        {!!lastAiSaid && (
          <Pressable style={{ marginTop: 14 }} onPress={() => setModal({ label: "Noor replied", text: lastAiSaid })}>
            <Text style={[styles.transcriptLabel, { color: colors.mutedForeground }]}>
              Noor replied  <Text style={{ fontSize: 10 }}>↗</Text>
            </Text>
            <Text style={[styles.transcriptBody, { color: colors.foreground }]} numberOfLines={4}>
              {lastAiSaid}
            </Text>
          </Pressable>
        )}
      </View>

      <TranscriptModal
        visible={!!modal}
        label={modal?.label ?? ""}
        text={modal?.text ?? ""}
        onClose={() => setModal(null)}
      />

      {/* Hang-up */}
      <View style={[styles.footer, { paddingBottom: botPad }]}>
        <Pressable
          style={({ pressed }) => [
            styles.hangUpBtn,
            { backgroundColor: "#ef4444", opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={hangUp}
        >
          <Feather name="phone-off" size={24} color="#fff" />
        </Pressable>
        <Text style={[styles.footerHint, { color: colors.mutedForeground }]}>End call</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  langToggle: { borderRadius: 10, paddingHorizontal: 8 },
  langToggleText: { fontSize: 12, fontWeight: "700" },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 12, fontWeight: "500", marginTop: 2 },

  callerArea: { alignItems: "center", marginTop: 20 },
  callerName: { fontSize: 26, fontWeight: "800" },
  callerRole: { fontSize: 13, fontWeight: "500", marginTop: 4 },

  avatarArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  statusLabel: { marginTop: 22, fontSize: 14, fontWeight: "500", textAlign: "center" },

  micArea: { alignItems: "center", paddingHorizontal: 24, paddingTop: 4, paddingBottom: 4 },
  micPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  micPillText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginHorizontal: 24,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  errorBannerText: { flex: 1, fontSize: 12, fontWeight: "500", color: "#ef4444", lineHeight: 17 },

  transcript: {
    paddingHorizontal: 26,
    minHeight: 110,
    justifyContent: "flex-start",
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  transcriptBody: { fontSize: 15, fontWeight: "500", lineHeight: 22 },
  transcriptHint: { fontSize: 13, fontWeight: "400", lineHeight: 20, textAlign: "center" },

  footer: { alignItems: "center", paddingTop: 10 },
  hangUpBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  footerHint: { fontSize: 12, fontWeight: "500", marginTop: 8 },
});