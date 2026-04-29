/**
 * AI provider abstraction for the Next.js backend.
 *
 *   - openai → OpenAI GPT family (OPENAI_API_KEY)
 *   - xai    → xAI Grok family   (XAI_API_KEY)
 *
 * Both providers use OpenAI-compatible chat-completion APIs; we just point
 * the same `openai` SDK at different base URLs. Add a new provider by adding
 * a case — nothing else in the codebase changes.
 */

import OpenAI from "openai";

export type ProviderId = "openai" | "xai" | "sou" | "ollama";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamParams {
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

// ─── Lazy provider clients ───────────────────────────────────────────────────

let _openai: OpenAI | null = null;
let _xai: OpenAI | null = null;
let _sou: OpenAI | null = null;
let _ollama: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  _openai = new OpenAI({ apiKey });
  return _openai;
}

function getXai(): OpenAI {
  if (_xai) return _xai;
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not configured");
  _xai = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
  return _xai;
}

function getSou(): OpenAI {
  if (_sou) return _sou;
  const apiKey = process.env.SOU_IMAGERY_API_KEY;
  if (!apiKey) throw new Error("SOU_IMAGERY_API_KEY is not configured");
  _sou = new OpenAI({ apiKey, baseURL: "https://api.souimagery.fun/v1" });
  return _sou;
}

function getOllama(): OpenAI {
  if (_ollama) return _ollama;
  
  const ollamaBase = process.env.OLLAMA_BASE_URL;
  if (!ollamaBase) throw new Error("OLLAMA_BASE_URL is not configured");

  let baseURL = ollamaBase.replace(/\/+$/, "");
  if (!baseURL.endsWith("/v1")) {
    baseURL += "/v1";
  }

  // Ollama provides local, unauthenticated OpenAI API compat layer at /v1.
  _ollama = new OpenAI({ apiKey: "ollama", baseURL });
  return _ollama;
}

// ─── Default models per provider ─────────────────────────────────────────────

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: "gpt-4.1",
  xai: "grok-4-latest",
  sou: "gpt-5.4",
  ollama: "qwen3-coder:30b",
};

// ─── Unified streaming helper ────────────────────────────────────────────────

export interface StreamChunk {
  content?: string;
  done: boolean;
}

export async function* streamCompletion(
  params: StreamParams,
): AsyncGenerator<StreamChunk> {
  const { provider, model, messages, maxTokens = 1024, temperature } = params;
  const client = provider === "xai" ? getXai() : provider === "sou" ? getSou() : provider === "ollama" ? getOllama() : getOpenAI();

  const stream = await client.chat.completions.create({
    model,
    // The newer OpenAI SDK prefers max_completion_tokens for GPT-4o+; xAI
    // only accepts max_tokens. Pass whichever the provider likes.
    ...(provider === "openai"
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens }),
    ...(temperature !== undefined ? { temperature } : {}),
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield { content, done: false };
  }
  yield { done: true };
}

export async function completion(params: StreamParams): Promise<string> {
  const { provider, model, messages, maxTokens = 256, temperature } = params;
  const client = provider === "xai" ? getXai() : provider === "sou" ? getSou() : provider === "ollama" ? getOllama() : getOpenAI();

  const response = await client.chat.completions.create({
    model,
    ...(provider === "openai"
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens }),
    ...(temperature !== undefined ? { temperature } : {}),
    messages,
  });
  return response.choices[0]?.message?.content ?? "";
}

export function normaliseProvider(raw: unknown): ProviderId {
  if (raw === "xai" || raw === "grok") return "xai";
  if (raw === "sou") return "sou";
  if (raw === "ollama") return "ollama";
  return "openai";
}

export function normaliseModel(provider: ProviderId, raw: unknown): string {
  if (typeof raw === "string" && raw.trim() && raw.length < 100) return raw.trim();
  return DEFAULT_MODELS[provider];
}

let _whisper: OpenAI | null = null;

/** Transcription uses a local whisper compatible endpoint. */
export function transcriptionClient(): OpenAI {
  if (_whisper) return _whisper;
  
  const whisperBase = process.env.WHISPER_BASE_URL;
  if (!whisperBase) throw new Error("WHISPER_BASE_URL is not configured");

  let baseURL = whisperBase.replace(/\/+$/, "");
  if (!baseURL.endsWith("/v1")) {
    baseURL += "/v1";
  }
  _whisper = new OpenAI({ apiKey: "local-whisper", baseURL });
  return _whisper;
}
