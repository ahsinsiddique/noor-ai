/**
 * Catalog of AI providers and models the user can pick from.
 *
 * Keep this list short and curated — listing every variant a provider ships
 * is noise; the user just wants "smart" or "fast". Model IDs must match
 * what the server side will actually call.
 */

export type ProviderId = "openai" | "xai" | "sou" | "ollama";

export interface AIModel {
  /** Model ID passed to the API (e.g. "gpt-4.1"). */
  id: string;
  /** Friendly name shown to the user. */
  name: string;
  /** One-line description shown under the name. */
  description: string;
  /** Rough speed/quality tag for the UI badge. */
  tier: "fast" | "balanced" | "smart";
}

export interface AIProvider {
  id: ProviderId;
  name: string;
  tagline: string;
  /** Emoji or short symbol for the card. */
  symbol: string;
  models: AIModel[];
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "ChatGPT",
    tagline: "OpenAI — default, well-rounded",
    symbol: "🧠",
    models: [
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        description: "OpenAI's flagship — best accuracy and nuance.",
        tier: "smart",
      },
      {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        description: "Faster, lighter; good for quick questions.",
        tier: "fast",
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Strong multilingual; handles Arabic/Urdu/Hindi well.",
        tier: "balanced",
      },
    ],
  },
  {
    id: "xai",
    name: "Grok",
    tagline: "xAI — fresh perspective, candid",
    symbol: "⚡",
    models: [
      {
        id: "grok-4-latest",
        name: "Grok 4",
        description: "xAI's flagship — strong reasoning.",
        tier: "smart",
      },
      {
        id: "grok-3",
        name: "Grok 3",
        description: "Previous generation — fast and stable.",
        tier: "balanced",
      },
      {
        id: "grok-3-mini",
        name: "Grok 3 Mini",
        description: "Lightweight — fastest responses.",
        tier: "fast",
      },
    ],
  },
  {
    id: "sou",
    name: "Sou Imagery",
    tagline: "Sou Imagery — Advanced capabilities",
    symbol: "✨",
    models: [
      {
        id: "gpt-5.4",
        name: "GPT-5.4",
        description: "Sou Imagery's flagship model.",
        tier: "smart",
      },
    ],
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    tagline: "Local open-source models",
    symbol: "🦙",
    models: [
      {
        id: "gpt-oss:20b",
        name: "GPT-OSS 20B",
        description: "Local model running via Ollama.",
        tier: "balanced",
      },
    ],
  },
];

export const DEFAULT_PROVIDER: ProviderId = "ollama";
export const DEFAULT_MODEL_ID = "gpt-oss:20b";

export function getProvider(id: ProviderId): AIProvider {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

export function getModel(providerId: ProviderId, modelId: string): AIModel {
  const p = getProvider(providerId);
  return p.models.find((m) => m.id === modelId) ?? p.models[0];
}
