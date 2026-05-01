import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

import { detectTtsLanguage } from "@/services/aiService";
import { getWhisperUrl } from "@/services/apiClient";

export type VoiceTurnState = "idle" | "recording" | "transcribing" | "speaking";

interface Options {
  forceLang: "ur" | "ar" | null;
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
}

interface UseVoiceTurnReturn {
  state: VoiceTurnState;
  seconds: number;
  error: string | null;
  clearError: () => void;
  startRecording: () => Promise<void>;
  endTurn: () => Promise<void>;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
}

const VOICE_INSTALL_HINTS: Record<string, string> = {
  "ur-PK": "Urdu voice not installed. Go to Settings → Accessibility → Spoken Content → Voices → Urdu.",
  "hi-IN": "Hindi voice not installed. Go to Settings → Accessibility → Spoken Content → Voices → Hindi.",
  "ar-SA": "Arabic voice not installed. Go to Settings → Accessibility → Spoken Content → Voices → Arabic.",
};

export function useVoiceTurn({ forceLang, onTranscript, onError }: Options): UseVoiceTurnReturn {
  const [state, setState] = useState<VoiceTurnState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

  // Native recorder
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Web recorder refs
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webStreamRef = useRef<MediaStream | null>(null);

  // Available TTS voices — loaded once on mount
  const availableVoicesRef = useRef<Speech.Voice[]>([]);

  // Keep options stable across renders without adding them to deps
  const forceLangRef = useRef(forceLang);
  forceLangRef.current = forceLang;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((v) => { availableVoicesRef.current = v; })
      .catch(() => {});
  }, []);

  // Recording timer
  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (endedRef.current) return;
      endedRef.current = true;
      Speech.stop();
      try {
        webStreamRef.current?.getTracks().forEach((t) => t.stop());
        webStreamRef.current = null;
      } catch {}
    };
  }, []);

  const emitError = useCallback((msg: string) => {
    setError(msg);
    onErrorRef.current?.(msg);
  }, []);

  // ─── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null);
    Speech.stop();

    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webStreamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        webChunksRef.current = [];
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        rec.ondataavailable = (e) => { if (e.data.size > 0) webChunksRef.current.push(e.data); };
        rec.start();
        webRecorderRef.current = rec;
        setState("recording");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const display = msg.toLowerCase().includes("permission") || msg.includes("NotAllowed")
          ? "Microphone permission denied"
          : "Could not access microphone";
        emitError(display);
        Alert.alert("Error", display);
        setState("idle");
      }
      return;
    }

    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      emitError("Microphone permission denied");
      setState("idle");
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setState("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      emitError(`Could not start recording: ${msg}`);
      setState("idle");
      Alert.alert("Recording Error", msg);
    }
  }, [audioRecorder, emitError]);

  // ─── Stop recording + transcribe ─────────────────────────────────────────────
  const endTurn = useCallback(async () => {
    setState("transcribing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    let formData: FormData | null = null;

    try {
      if (Platform.OS === "web") {
        const rec = webRecorderRef.current;
        if (!rec) throw new Error("No active recording");
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.stop();
        });
        webStreamRef.current?.getTracks().forEach((t) => t.stop());
        webStreamRef.current = null;
        const blob = new Blob(webChunksRef.current, { type: "audio/webm" });
        formData = new FormData();
        formData.append("file", blob, "recording.webm");
      } else {
        await audioRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        await new Promise<void>((r) => setTimeout(r, 80));
        const uri = audioRecorder.uri;
        if (!uri) throw new Error("Recording failed — no file saved");
        formData = new FormData();
        formData.append("file", { uri, type: "audio/m4a", name: "recording.m4a" } as unknown as Blob);
      }

      formData.append("task", "transcribe");
      const lang = forceLangRef.current;
      if (lang) formData.append("language", lang);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      emitError(msg);
      setState("idle");
      Alert.alert("Error", msg);
      return;
    }

    try {
      const res = await fetch(getWhisperUrl(), { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Transcribe ${res.status}: ${body}`);
      }
      const data = await res.json();
      const text = (typeof data === "string" ? data : (data.text || data.transcription || "")).trim();
      if (!text) {
        emitError("Didn't catch that — try again");
        setState("idle");
        return;
      }
      setState("idle");
      onTranscriptRef.current(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isNetwork = msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("failed to");
      const display = isNetwork ? `Whisper server unreachable (${getWhisperUrl()})` : `Transcription failed: ${msg}`;
      emitError(display);
      Alert.alert("Transcription Error", display);
      setState("idle");
    }
  }, [audioRecorder, emitError]);

  // ─── TTS ────────────────────────────────────────────────────────────────────
  const speakText = useCallback((text: string) => {
    const lang = forceLangRef.current;
    const forcedLocale = lang === "ur" ? "ur-PK" : lang === "ar" ? "ar-SA" : null;
    const detected = detectTtsLanguage(text);
    const detectedLocale = detected === "ur" ? "ur-PK" : detected === "hi" ? "hi-IN" : "en-US";
    const locale = forcedLocale ?? detectedLocale;

    const findVoiceId = (l: string): string | undefined => {
      const prefix = l.split("-")[0].toLowerCase();
      const voices = availableVoicesRef.current;
      const enhanced = voices.find((v) => v.language.toLowerCase().startsWith(prefix) && v.quality === "Enhanced");
      return (enhanced ?? voices.find((v) => v.language.toLowerCase().startsWith(prefix)))?.identifier;
    };

    const trySpeak = (l: string, fallback?: string) => {
      const voiceId = findVoiceId(l);
      if (!voiceId && l !== "en-US") {
        const hint = VOICE_INSTALL_HINTS[l];
        if (hint) setError(hint);
        trySpeak("en-US");
        return;
      }
      setState("speaking");
      Speech.speak(text, {
        language: l,
        ...(voiceId ? { voice: voiceId } : {}),
        rate: 0.95,
        pitch: 0.9,
        onDone: () => setState((s) => (s === "speaking" ? "idle" : s)),
        onStopped: () => setState((s) => (s === "speaking" ? "idle" : s)),
        onError: () => { if (fallback) trySpeak(fallback); else setState("idle"); },
      });
    };

    trySpeak(locale, locale !== "en-US" ? "en-US" : undefined);
  }, []);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setState((s) => (s === "speaking" ? "idle" : s));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { state, seconds, error, clearError, startRecording, endTurn, speakText, stopSpeaking };
}