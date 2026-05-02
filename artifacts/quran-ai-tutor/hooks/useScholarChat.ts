import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Keyboard, Platform, ScrollView } from "react-native";

import { type ChatMsg } from "@/types/chat";
import {
  detectTtsLanguage,
  streamGuardianChat,
  type AIIdentity,
} from "@/services/aiService";

interface Options {
  identity: AIIdentity;
  welcomeContent: string;
}

export interface UseScholarChatReturn {
  messages: ChatMsg[];
  input: string;
  setInput: (t: string) => void;
  streaming: boolean;
  speakingId: string | null;
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  scrollRef: React.MutableRefObject<ScrollView | null>;
  sendMessage: (text?: string) => Promise<void>;
  speakMessage: (msg: ChatMsg) => Promise<void>;
  stopSpeaking: () => void;
}

export function useScholarChat({ identity, welcomeContent }: Options): UseScholarChatReturn {
  const [messages, setMessages] = useState<ChatMsg[]>([{
    id: "welcome",
    role: "assistant",
    content: welcomeContent,
    timestamp: Date.now(),
  }]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Refs to avoid stale closures in callbacks without adding to dep arrays
  const inputRef = useRef(input);
  inputRef.current = input;
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  // Voice caching refs
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

  // ─── Load installed device voices once, pick scholarly male voice per lang ───
  const loadVoices = useCallback(async () => {
    if (voicesLoadedRef.current) return;
    voicesLoadedRef.current = true;
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const PREFIXES: Record<string, string[]> = {
        en: ["en", "eng"],
        hi: ["hi", "hin"],
        ur: ["ur", "urd"],
      };
      const matchesFor = (lang: string) => {
        const prefixes = PREFIXES[lang] ?? [lang];
        return voices.filter((v) =>
          prefixes.some((p) => (v.language ?? "").toLowerCase().startsWith(p))
        );
      };
      const pickMaleId = (list: typeof voices): string | undefined => {
        if (list.length === 0) return undefined;
        const male = list.find((v) =>
          /male|rishi|rajeev|salman|aamir|asad|onyx|daniel|fred|alex/i.test(
            v.identifier + " " + ((v as { name?: string }).name ?? "")
          )
        );
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
    } catch {
      // Voice listing unsupported on this platform — proceed with defaults.
    }
  }, []);

  useEffect(() => { void loadVoices(); }, [loadVoices]);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setSpeakingId(null);
  }, []);

  // ─── TTS with auto language detection and male scholarly voice ───────────────
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
      Alert.alert(
        `${langName} voice not installed`,
        `Your device doesn't have a ${langName} voice installed. Install one from: ${where}.`,
      );
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

  // ─── Stream a guardian chat turn ─────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const trimmed = (text ?? inputRef.current).trim();
    if (!trimmed || streamingRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInput("");
    setShowSuggestions(false);
    Keyboard.dismiss();
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const aiId = `a-${Date.now() + 1}`;
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: trimmed, timestamp: Date.now() };
    const aiMsg: ChatMsg = { id: aiId, role: "assistant", content: "", timestamp: Date.now() + 1 };

    const history = messagesRef.current.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setStreaming(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    let finalContent = "";
    try {
      await streamGuardianChat(
        { message: trimmed, history, identity: identityRef.current },
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
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: "I couldn't connect right now. Please check your connection and try again." }
              : m
          )
        );
      }
    }

    setStreaming(false);
  }, [playWithVoice]);

  return {
    messages,
    input,
    setInput,
    streaming,
    speakingId,
    showSuggestions,
    setShowSuggestions,
    scrollRef,
    sendMessage,
    speakMessage,
    stopSpeaking,
  };
}