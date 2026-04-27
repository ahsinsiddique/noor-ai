import { fetch as expoFetch } from "expo/fetch";

import { apiUrl } from "@/services/apiClient";
import { getAccessToken } from "@/lib/supabase";

export type LearningLevel = "Beginner" | "Intermediate" | "Advanced";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatContext {
  surahName: string;
  surahArabic: string;
  ayahNumber: number;
  ayahArabic: string;
  ayahTranslation: string;
  userLevel: LearningLevel;
}

export interface AIIdentity {
  provider?: "openai" | "xai";
  model?: string;
  sect?: "sunni" | "shia" | "ibadi" | "general" | null;
  subSchool?: string | null;
  madhhab?: string | null;
}

// ─── Prompt templates (kept for any client-side use — server has its own) ────

export const PROMPTS = {
  systemBase: (level: LearningLevel) =>
    `You are a helpful Quran teacher. Explain clearly, simply, and respectfully.

Your student is a ${level} learner.
${level === "Beginner"
  ? "Use plain language, avoid heavy Arabic terminology, and focus on the core meaning."
  : level === "Intermediate"
  ? "You may introduce Arabic root words and brief grammatical notes when helpful."
  : "Engage with tafsir traditions, classical Arabic, and scholarly perspectives."}

Rules:
- Keep responses concise (2–4 short paragraphs).
- Use transliteration when quoting Arabic words.
- Be warm, patient, and encouraging.
- Never issue fatwas or personal religious rulings.`,

  ayahContext: (ctx: ChatContext) =>
    `The student is currently studying:
Surah: ${ctx.surahName} (${ctx.surahArabic})
Ayah ${ctx.ayahNumber}: "${ctx.ayahArabic}"
Translation: "${ctx.ayahTranslation}"

Answer the student's question in the context of this ayah.`,

  sessionSummary: (messages: ChatMessage[]) => {
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role === "user" ? "Student" : "Teacher"}: ${m.content}`)
      .join("\n");
    return `Summarize this Quran learning session in 1–2 sentences. Focus on what topics were discussed and any insights gained:\n\n${conversation}`;
  },

  quizExplanation: (question: string, correctAnswer: string, surahName: string) =>
    `In the context of Surah ${surahName}, briefly explain why "${correctAnswer}" is the correct answer to: "${question}". Keep it to 2 sentences.`,
} as const;

export function buildChatMessages(
  userMessage: string,
  ctx: ChatContext,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): ChatMessage[] {
  return [
    { role: "system", content: `${PROMPTS.systemBase(ctx.userLevel)}\n\n${PROMPTS.ayahContext(ctx)}` },
    ...history,
    { role: "user", content: userMessage },
  ];
}

// ─── Shared SSE stream reader ─────────────────────────────────────────────────
//
// NOTE: we use `expo/fetch` here (not the global fetch) because it reliably
// supports ReadableStream response bodies on native. The regular `fetch`
// polyfill on some RN versions buffers the whole response before returning,
// which would defeat the whole point of streaming.

async function readSseStream(
  response: Response,
  onChunk: (text: string) => void,
): Promise<void> {
  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          content?: string;
          error?: string;
        };
        if (parsed.error) throw new Error(parsed.error);
        const delta = parsed.choices?.[0]?.delta?.content ?? parsed.content ?? "";
        if (delta) onChunk(delta);
      } catch (err) {
        // JSON errors are swallowed; upstream errors (parsed.error above)
        // carry a meaningful message so we re-throw those.
        if (err instanceof Error && err.message && !err.message.startsWith("Unexpected")) {
          throw err;
        }
      }
    }
  }
}

// ─── Shared authed SSE POST ──────────────────────────────────────────────────

async function streamSsePost(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await expoFetch(apiUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  await readSseStream(response as unknown as Response, onChunk);
}

// ─── Lesson chat (ayah context) ───────────────────────────────────────────────

export async function streamChat(
  params: {
    message: string;
    context: ChatContext;
    teacherPrompt?: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    identity?: AIIdentity;
  },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { message, context, teacherPrompt, history, identity } = params;
  await streamSsePost(
    "/api/quran/chat",
    {
      message,
      surahName: context.surahName,
      surahArabic: context.surahArabic,
      ayahNumber: context.ayahNumber,
      ayahText: context.ayahArabic,
      ayahTranslation: context.ayahTranslation,
      userLevel: context.userLevel,
      teacherPrompt,
      provider: identity?.provider,
      model: identity?.model,
      sect: identity?.sect,
      subSchool: identity?.subSchool,
      madhhab: identity?.madhhab,
      history,
    },
    onChunk,
    signal,
  );
}

// ─── Guardian (Noor AI Scholar) chat ──────────────────────────────────────────

export async function streamGuardianChat(
  params: {
    message: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    identity?: AIIdentity;
  },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { message, history, identity } = params;
  await streamSsePost(
    "/api/quran/chat",
    {
      mode: "guardian",
      message,
      provider: identity?.provider,
      model: identity?.model,
      sect: identity?.sect,
      subSchool: identity?.subSchool,
      madhhab: identity?.madhhab,
      history,
    },
    onChunk,
    signal,
  );
}

// ─── Summary (non-streaming) ──────────────────────────────────────────────────

export async function generateSummary(
  messages: ChatMessage[],
  identity?: AIIdentity,
): Promise<string> {
  const token = await getAccessToken();
  const response = await fetch(apiUrl("/api/quran/summarize"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      messages,
      provider: identity?.provider,
      model: identity?.model,
    }),
  });

  if (!response.ok) throw new Error("Failed to generate summary");
  const data = (await response.json()) as { summary: string };
  return data.summary ?? "Session completed.";
}

// ─── Language detection for TTS ───────────────────────────────────────────────

export type TtsLanguage = "en" | "hi" | "ur";

export function detectTtsLanguage(text: string): TtsLanguage {
  if (!text) return "en";
  let devanagari = 0;
  let arabic = 0;
  let letters = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0900 && code <= 0x097f) {
      devanagari++;
      letters++;
      continue;
    }
    if (
      (code >= 0x0600 && code <= 0x06ff) ||
      (code >= 0x0750 && code <= 0x077f) ||
      (code >= 0x08a0 && code <= 0x08ff) ||
      (code >= 0xfb50 && code <= 0xfdff) ||
      (code >= 0xfe70 && code <= 0xfeff)
    ) {
      arabic++;
      letters++;
      continue;
    }
    if (/\p{L}/u.test(ch)) letters++;
  }
  if (letters === 0) return "en";
  if (devanagari / letters >= 0.2) return "hi";
  if (arabic / letters >= 0.4) return "ur";
  return "en";
}

// ─── Quiz explanation (non-streaming) ─────────────────────────────────────────

export async function getQuizExplanation(
  question: string,
  correctAnswer: string,
  surahName: string,
  identity?: AIIdentity,
): Promise<string> {
  const token = await getAccessToken();
  const response = await fetch(apiUrl("/api/quran/explain"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      question,
      correctAnswer,
      surahName,
      provider: identity?.provider,
      model: identity?.model,
    }),
  });

  if (!response.ok) throw new Error("Failed to get explanation");
  const data = (await response.json()) as { explanation: string };
  return data.explanation ?? "";
}
