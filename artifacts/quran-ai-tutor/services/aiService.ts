import { fetch as expoFetch } from "expo/fetch";

import { apiUrl, getOllamaUrl } from "@/services/apiClient";
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
  provider?: "openai" | "xai" | "sou" | "ollama";
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
- Never issue fatwas or personal religious rulings.
- CRITICAL: Always reply in the exact same language the user writes in. If the user writes in Urdu, reply fully in Urdu script. If in Arabic, reply in Arabic. If in English, reply in English. Never switch languages unless the user does.`,

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

// ─── Shared SSE & NDJSON stream readers ───────────────────────────────────────
//
// NOTE: we use `expo/fetch` here (not the global fetch) because it reliably
// supports ReadableStream response bodies on native. The regular `fetch`
// polyfill on some RN versions buffers the whole response before returning,
// which would defeat the whole point of streaming.

async function readOllamaStream(
  response: Response,
  onChunk: (text: string) => void,
): Promise<void> {
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
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
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.error) throw new Error(parsed.error);
        
        if (parsed.message?.content) {
          onChunk(parsed.message.content);
        } else if (parsed.response) {
          onChunk(parsed.response);
        }
      } catch (err) {
        if (err instanceof Error && err.message && !err.message.startsWith("Unexpected")) {
          throw err;
        }
      }
    }
  }
}
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

  if (identity?.provider === "ollama") {
    const messages = buildChatMessages(message, context, history);
    if (teacherPrompt && messages[0].role === "system") {
      messages[0].content = `${teacherPrompt}\n\n${messages[0].content}`;
    }

    const response = await expoFetch(getOllamaUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: identity?.model || "gpt-oss:20b",
        messages,
        stream: true,
      }),
      signal,
    });
    
    await readOllamaStream(response as unknown as Response, onChunk);
    return;
  }

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
    voiceMode?: boolean;
  },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { message, history, identity, voiceMode = false } = params;

  if (identity?.provider === "ollama") {
    const { sect, madhhab, subSchool } = identity;
    const sectLine = buildSectLine(sect ?? null, madhhab ?? null, subSchool ?? null);

    const systemPrompt = voiceMode
      ? `You are Noor AI, a knowledgeable Islamic scholar in a live voice conversation.${sectLine}

Strict voice rules — follow every one:
- Answer in 1 to 3 short spoken sentences maximum. Never longer.
- Zero markdown: no asterisks, no bold, no bullet points, no numbered lists, no headers, no dashes.
- Plain conversational speech only, as if talking directly to the person.
- Do not start with greetings or "Bismillah" — go straight to the answer.
- No fatwas or personal religious rulings.
- Reply in the exact same language the user speaks in. Urdu → Urdu script. Arabic → Arabic. English → English.`
      : `You are a knowledgeable Islamic scholar.${sectLine} Provide warm, grounded guidance. Keep responses concise and avoid fatwas. CRITICAL: Always reply in the exact same language the user writes in — Urdu → Urdu script, Arabic → Arabic, English → English.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    const response = await expoFetch(getOllamaUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: identity?.model || "gpt-oss:20b",
        messages,
        stream: true,
      }),
      signal,
    });

    await readOllamaStream(response as unknown as Response, onChunk);
    return;
  }

  await streamSsePost(
    "/api/quran/chat",
    {
      mode: "guardian",
      voiceMode,
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

function buildSectLine(
  sect: string | null,
  madhhab: string | null,
  subSchool: string | null,
): string {
  if (!sect || sect === "general") return "";
  const parts = [sect, madhhab, subSchool].filter(Boolean);
  return ` The user follows the ${parts.join(" — ")} tradition. Base answers on this tradition's scholarship and fiqh.`;
}

// ─── Summary (non-streaming) ──────────────────────────────────────────────────

export async function generateSummary(
  messages: ChatMessage[],
  identity?: AIIdentity,
): Promise<string> {
  if (identity?.provider === "ollama") {
    const prompt = PROMPTS.sessionSummary(messages);
    const response = await fetch(getOllamaUrl("/api/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: identity?.model || "gpt-oss:20b",
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) throw new Error("Failed to generate summary via Ollama");
    const data = await response.json() as { response: string };
    return data.response ?? "Session completed.";
  }

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

const unicodeLetterRe = /\p{L}/u;

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
    if (unicodeLetterRe.test(ch)) letters++;
  }
  if (letters === 0) return "en";
  if (devanagari / letters >= 0.2) return "hi";
  if (arabic / letters >= 0.55) return "ur";
  return "en";
}

// ─── Quiz explanation (non-streaming) ─────────────────────────────────────────

export async function getQuizExplanation(
  question: string,
  correctAnswer: string,
  surahName: string,
  identity?: AIIdentity,
): Promise<string> {
  if (identity?.provider === "ollama") {
    const prompt = PROMPTS.quizExplanation(question, correctAnswer, surahName);
    const response = await fetch(getOllamaUrl("/api/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: identity?.model || "gpt-oss:20b",
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) throw new Error("Failed to get explanation via Ollama");
    const data = await response.json() as { response: string };
    return data.response ?? "";
  }

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
