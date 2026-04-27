import { Feather } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
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
import { apiUrl } from "@/services/apiClient";
import { getAccessToken } from "@/lib/supabase";
import { detectTtsLanguage, streamGuardianChat } from "@/services/aiService";

/**
 * Call Noor — a hands-free, phone-call-style experience for Noor AI Scholar.
 *
 * Flow per turn (native / iOS / Android):
 *   idle → user taps orb → recording → user taps orb again → transcribing
 *   → streaming (AI replies) → speaking (TTS plays reply) → idle
 *
 * Flow per turn (web):
 *   Same as native but uses MediaRecorder. Users can still tap the orb
 *   to end the turn early.
 *
 * At any point during "speaking" the user can tap the orb to barge in —
 * TTS stops immediately and a new recording starts. This is the main
 * UX fix for the old "not working well" voice experience: no more
 * juggling mic + send + listen buttons.
 */

type CallState = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export default function CallNoorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { madhhab } = useMadhhab();
  const { sect, subSchool } = useSect();
  const { provider, modelId, providerMeta, modelMeta } = useModel();

  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [lastUserSaid, setLastUserSaid] = useState<string>("");
  const [lastAiSaid, setLastAiSaid] = useState<string>("");

  // Ring-animation for the orb while recording/speaking
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Native recorder
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Web recorder
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webStreamRef = useRef<MediaStream | null>(null);

  // Conversation memory so each turn has context. We keep up to ~20 turns
  // which comfortably fits in the model context for any provider.
  const historyRef = useRef<Turn[]>([]);

  // Abort the in-flight AI stream when the user barges in or hangs up.
  const abortRef = useRef<AbortController | null>(null);

  // Start the call-ended cleanup only once, even if effects fire twice.
  const endedRef = useRef(false);

  // ─── Pulse / timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (state === "recording") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (state === "speaking") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }

    if (state !== "recording") {
      if (timerRef.current) clearInterval(timerRef.current);
      setSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (endedRef.current) return;
      endedRef.current = true;
      abortRef.current?.abort();
      Speech.stop();
      try {
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((t) => t.stop());
          webStreamRef.current = null;
        }
      } catch {}
    };
  }, []);

  // ─── Start recording (per platform) ────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null);

    // Stop any TTS that was playing (barge-in).
    Speech.stop();
    abortRef.current?.abort();

    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webStreamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        webChunksRef.current = [];
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) webChunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          // onstop fires after stopRecording() transitions state — we read the
          // blob + send it there.
        };
        rec.start();
        webRecorderRef.current = rec;
        setState("recording");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes("permission") || msg.includes("NotAllowed")) {
          setError("Microphone permission denied");
        } else {
          setError("Could not access microphone");
        }
        setState("idle");
      }
      return;
    }

    // Native
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      setError("Microphone permission denied");
      setState("idle");
      return;
    }
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setState("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not start recording: ${msg}`);
      setState("idle");
    }
  }, [audioRecorder]);

  // ─── Stop recording + run the whole turn ───────────────────────────────────
  const endTurn = useCallback(async () => {
    setState("transcribing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const token = await getAccessToken();
    if (!token) {
      setError("Not signed in");
      setState("idle");
      return;
    }

    // ─── 1. Stop recording and build a Blob/FormData ─────────────────────────
    let formData: FormData | null = null;

    try {
      if (Platform.OS === "web") {
        const rec = webRecorderRef.current;
        if (!rec) throw new Error("No active recording");
        // Wait for the final dataavailable event after stop().
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.stop();
        });
        webStreamRef.current?.getTracks().forEach((t) => t.stop());
        webStreamRef.current = null;
        const blob = new Blob(webChunksRef.current, { type: "audio/webm" });
        formData = new FormData();
        formData.append("audio", blob, "call.webm");
      } else {
        await audioRecorder.stop();
        await new Promise<void>((r) => setTimeout(r, 80));
        const uri = audioRecorder.uri;
        if (!uri) throw new Error("Recording failed — no file saved");
        formData = new FormData();
        formData.append("audio", {
          uri,
          type: "audio/m4a",
          name: "call.m4a",
        } as unknown as Blob);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setState("idle");
      return;
    }

    // ─── 2. Transcribe ────────────────────────────────────────────────────────
    let transcript = "";
    try {
      const res = await fetch(apiUrl("/api/quran/transcribe"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Transcribe ${res.status}`);
      const data = (await res.json()) as { text?: string };
      transcript = (data.text ?? "").trim();
      if (!transcript) {
        setError("Didn't catch that — try again");
        setState("idle");
        return;
      }
      setLastUserSaid(transcript);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Transcription failed: ${msg}`);
      setState("idle");
      return;
    }

    // ─── 3. Stream AI reply ───────────────────────────────────────────────────
    setState("thinking");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let aiText = "";
    try {
      await streamGuardianChat(
        {
          message: transcript,
          history: historyRef.current,
          identity: {
            provider,
            model: modelId,
            sect,
            subSchool,
            madhhab,
          },
        },
        (delta) => {
          aiText += delta;
          setLastAiSaid(aiText);
        },
        ctrl.signal,
      );
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        // User barged in — just return to idle silently.
        setState("idle");
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      setError(`AI error: ${msg}`);
      setState("idle");
      return;
    }

    // Remember this turn
    historyRef.current = [
      ...historyRef.current,
      { role: "user", content: transcript },
      { role: "assistant", content: aiText },
    ].slice(-20); // keep last 10 turns

    if (!aiText.trim()) {
      setState("idle");
      return;
    }

    // ─── 4. Speak the reply ───────────────────────────────────────────────────
    setState("speaking");
    const lang = detectTtsLanguage(aiText);
    const locale = lang === "hi" ? "hi-IN" : lang === "ur" ? "ur-PK" : "en-US";
    Speech.speak(aiText, {
      language: locale,
      rate: 0.95,
      pitch: 0.9,
      onDone: () => setState((s) => (s === "speaking" ? "idle" : s)),
      onStopped: () => setState((s) => (s === "speaking" ? "idle" : s)),
      onError: () => setState("idle"),
    });
  }, [audioRecorder, provider, modelId, sect, subSchool, madhhab]);

  // ─── Single "orb" button handles every state ───────────────────────────────
  const handleOrbPress = useCallback(() => {
    switch (state) {
      case "idle":
        void startRecording();
        return;
      case "recording":
        void endTurn();
        return;
      case "speaking":
        // Barge-in: stop AI, start new recording
        Speech.stop();
        void startRecording();
        return;
      default:
        // transcribing/thinking — ignore taps so users can't create races
        return;
    }
  }, [state, startRecording, endTurn]);

  // ─── Hang up ───────────────────────────────────────────────────────────────
  const hangUp = useCallback(() => {
    endedRef.current = true;
    abortRef.current?.abort();
    Speech.stop();
    try {
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    try {
      if (Platform.OS !== "web") audioRecorder.stop();
    } catch {}
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {},
    );
    router.back();
  }, [audioRecorder]);

  // ─── Microphone permission helper (native first-call UX) ───────────────────
  useEffect(() => {
    if (Platform.OS === "web") return;
    AudioModule.requestRecordingPermissionsAsync().then(({ granted }) => {
      if (!granted) {
        Alert.alert(
          "Microphone needed",
          "Call Noor needs your microphone to hear your questions. Please grant permission in system settings.",
        );
      }
    });
  }, []);

  // ─── UI helpers ────────────────────────────────────────────────────────────
  const statusLabel = (() => {
    switch (state) {
      case "idle":
        return "Tap the orb to speak";
      case "recording":
        return `Listening… ${Math.floor(seconds / 60)
          .toString()
          .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
      case "transcribing":
        return "Transcribing…";
      case "thinking":
        return "Noor is thinking…";
      case "speaking":
        return "Noor is speaking — tap to interrupt";
    }
  })();

  const orbColor = (() => {
    switch (state) {
      case "recording":
        return "#ef4444";
      case "speaking":
        return colors.accent ?? "#f59e0b";
      case "transcribing":
      case "thinking":
        return colors.mutedForeground;
      default:
        return colors.primary;
    }
  })();

  const orbIcon: keyof typeof Feather.glyphMap =
    state === "recording"
      ? "square"
      : state === "speaking"
      ? "volume-2"
      : state === "transcribing" || state === "thinking"
      ? "loader"
      : "mic";

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
        <View style={styles.headerBtn} />
      </View>

      {/* Caller identity */}
      <View style={styles.callerArea}>
        <Text style={[styles.callerName, { color: colors.foreground }]}>Noor AI</Text>
        <Text style={[styles.callerRole, { color: colors.mutedForeground }]}>
          Digital Guardian · Online
        </Text>
      </View>

      {/* Scholar avatar — state-driven breathing / listening / speaking animations */}
      <View style={styles.avatarArea}>
        <ScholarAvatar
          state={state as AvatarState}
          variant="portrait"
          size={300}
        />
        <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>
          {statusLabel}
        </Text>
        {!!error && (
          <Text style={[styles.errorText, { color: colors.destructive ?? "#ef4444" }]}>
            {error}
          </Text>
        )}
      </View>

      {/* Mic pill — the tap target for start/stop talking + barge-in */}
      <View style={styles.micArea}>
        <Pressable
          style={({ pressed }) => [
            styles.micPill,
            {
              backgroundColor: orbColor,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          onPress={handleOrbPress}
          disabled={state === "transcribing" || state === "thinking"}
          accessibilityLabel={statusLabel}
        >
          <Feather name={orbIcon} size={22} color="#fff" />
          <Text style={styles.micPillText}>
            {state === "idle"
              ? "Tap to speak"
              : state === "recording"
              ? "Tap to send"
              : state === "speaking"
              ? "Tap to interrupt"
              : "…"}
          </Text>
        </Pressable>
      </View>

      {/* Transcript preview */}
      <View style={styles.transcript}>
        {lastUserSaid ? (
          <>
            <Text style={[styles.transcriptLabel, { color: colors.mutedForeground }]}>
              You said
            </Text>
            <Text
              style={[styles.transcriptBody, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {lastUserSaid}
            </Text>
          </>
        ) : (
          <Text style={[styles.transcriptHint, { color: colors.mutedForeground }]}>
            Assalamu Alaikum{user?.name ? `, ${user.name}` : ""}. Ask Noor anything —
            about Islam, daily guidance, duas, or this week's reflections.
          </Text>
        )}
        {!!lastAiSaid && (
          <>
            <Text
              style={[styles.transcriptLabel, { color: colors.mutedForeground, marginTop: 14 }]}
            >
              Noor replied
            </Text>
            <Text
              style={[styles.transcriptBody, { color: colors.foreground }]}
              numberOfLines={4}
            >
              {lastAiSaid}
            </Text>
          </>
        )}
      </View>

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
        <Text style={[styles.footerHint, { color: colors.mutedForeground }]}>
          End call
        </Text>
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
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 12, fontWeight: "500", marginTop: 2 },

  callerArea: { alignItems: "center", marginTop: 20 },
  callerName: { fontSize: 26, fontWeight: "800" },
  callerRole: { fontSize: 13, fontWeight: "500", marginTop: 4 },

  avatarArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  statusLabel: { marginTop: 22, fontSize: 14, fontWeight: "500", textAlign: "center" },
  errorText: { marginTop: 10, fontSize: 12, fontWeight: "500", textAlign: "center" },

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
