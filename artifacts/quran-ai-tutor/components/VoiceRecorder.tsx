import { AudioModule, RecordingPresets, useAudioRecorder } from "expo-audio";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/services/apiClient";
import { getAccessToken } from "@/lib/supabase";

interface Props {
  onTranscript: (text: string) => void;
  onBeforeRecord?: () => void;
  disabled?: boolean;
}

type RecordState = "idle" | "recording" | "transcribing";

export function VoiceRecorder({ onTranscript, onBeforeRecord, disabled }: Props) {
  const colors = useColors();
  const [state, setState] = useState<RecordState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Native recorder
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Web recorder refs
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webMimeRef = useRef<string>("audio/webm");

  // Pulse + timer while recording
  useEffect(() => {
    if (state === "recording") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      if (timerRef.current) clearInterval(timerRef.current);
      setSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  // ─── Shared transcription helper ──────────────────────────────────────────
  const sendToTranscribe = useCallback(async (blob: Blob, filename: string, mimeType: string) => {
    const token = await getAccessToken();
    if (!token) throw new Error("Not signed in");

    const formData = new FormData();
    formData.append("audio", blob as unknown as Blob, filename);

    const res = await fetch(apiUrl("/api/quran/transcribe"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => res.status.toString());
      throw new Error(`Server error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { text?: string; error?: string };
    if (data.text?.trim()) {
      onTranscript(data.text.trim());
    } else {
      setError("Couldn't hear clearly — please try again");
    }
  }, [onTranscript]);

  // ─── Web recording (browser MediaRecorder) ────────────────────────────────
  const startWebRecording = useCallback(async () => {
    setError(null);
    try {
      onBeforeRecord?.();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      webMimeRef.current = mimeType || "audio/webm";
      webChunksRef.current = [];

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) webChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          const blob = new Blob(webChunksRef.current, { type: webMimeRef.current });
          await sendToTranscribe(blob, "recording.webm", webMimeRef.current);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[VoiceRecorder] web transcription error:", msg);
          setError("Transcription failed — please try again");
        } finally {
          setState("idle");
        }
      };
      recorder.start();
      webRecorderRef.current = recorder;
      setState("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
        setError("Microphone permission denied");
      } else {
        setError("Could not access microphone");
        console.error("[VoiceRecorder] web start error:", msg);
      }
    }
  }, [onBeforeRecord, sendToTranscribe]);

  const stopWebRecording = useCallback(() => {
    if (webRecorderRef.current && webRecorderRef.current.state !== "inactive") {
      setState("transcribing");
      webRecorderRef.current.stop();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  // ─── Native recording (expo-audio) ────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null);
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      setError("Microphone permission denied");
      return;
    }

    try { onBeforeRecord?.(); } catch {}
    await new Promise<void>((r) => setTimeout(r, 120));

    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setState("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not start recording: ${msg}`);
      console.error("[VoiceRecorder] start error:", msg);
    }
  }, [audioRecorder, onBeforeRecord]);

  const stopRecording = useCallback(async () => {
    setState("transcribing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      await audioRecorder.stop();
      await new Promise<void>((r) => setTimeout(r, 80));

      const uri = audioRecorder.uri;
      if (!uri) throw new Error("Recording URI is empty — file may not have been saved");

      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");

      const formData = new FormData();
      formData.append("audio", {
        uri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as unknown as Blob);

      const res = await fetch(apiUrl("/api/quran/transcribe"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => res.status.toString());
        throw new Error(`Server error ${res.status}: ${body}`);
      }

      const data = (await res.json()) as { text?: string; error?: string };
      if (data.text?.trim()) {
        onTranscript(data.text.trim());
      } else {
        setError("Couldn't hear clearly — please try again");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[VoiceRecorder] stop error:", msg);
      setError("Transcription failed — please type instead");
    } finally {
      setState("idle");
    }
  }, [audioRecorder, onTranscript]);

  // ─── Unified press handler ─────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    if (disabled) return;
    if (Platform.OS === "web") {
      if (state === "idle") startWebRecording();
      else if (state === "recording") stopWebRecording();
    } else {
      if (state === "idle") startRecording();
      else if (state === "recording") stopRecording();
    }
  }, [state, disabled, startRecording, stopRecording, startWebRecording, stopWebRecording]);

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  const btnColor = isRecording
    ? "#ef4444"
    : isTranscribing
    ? colors.mutedForeground
    : colors.primary;

  return (
    <View style={styles.root}>
      <Animated.View style={[
        styles.pulseRing,
        { borderColor: btnColor, transform: [{ scale: isRecording ? pulseAnim : 1 }], opacity: isRecording ? 0.4 : 0 },
      ]} />
      <Pressable
        style={[styles.btn, { backgroundColor: btnColor, opacity: disabled || isTranscribing ? 0.5 : 1 }]}
        onPress={handlePress}
        disabled={disabled || isTranscribing}
        accessibilityLabel={isRecording ? "Stop recording" : "Start voice input"}
      >
        {isTranscribing ? (
          <Feather name="loader" size={18} color="#fff" />
        ) : isRecording ? (
          <Feather name="square" size={16} color="#fff" />
        ) : (
          <Feather name="mic" size={18} color="#fff" />
        )}
      </Pressable>
      {isRecording && (
        <Text style={[styles.timer, { color: "#ef4444" }]}>
          {Math.floor(seconds / 60).toString().padStart(2, "0")}:{(seconds % 60).toString().padStart(2, "0")}
        </Text>
      )}
      {!!error && (
        <Text style={[styles.error, { color: colors.destructive }]} numberOfLines={3}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", position: "relative", width: 44, height: 44 },
  pulseRing: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  timer: { position: "absolute", bottom: 48, fontSize: 11, fontWeight: "600" },
  error: { position: "absolute", bottom: 48, fontSize: 10, fontWeight: "400", textAlign: "center", width: 160 },
});
