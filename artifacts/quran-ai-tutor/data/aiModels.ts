/**
 * Catalog of AI providers and models the user can pick from.
 *
 * Keep this list short and curated — listing every variant a provider ships
 * is noise; the user just wants "smart" or "fast". Model IDs must match
 * what the server side will actually call.
 */

export type ProviderId = "openai" | "xai";

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
];

export const DEFAULT_PROVIDER: ProviderId = "openai";
export const DEFAULT_MODEL_ID = "gpt-4.1";

export function getProvider(id: ProviderId): AIProvider {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

export function getModel(providerId: ProviderId, modelId: string): AIModel {
  const p = getProvider(providerId);
  return p.models.find((m) => m.id === modelId) ?? p.models[0];
}
