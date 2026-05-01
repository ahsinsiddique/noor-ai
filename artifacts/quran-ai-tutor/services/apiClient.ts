/**
 * Thin wrapper around fetch for talking to the Next.js backend.
 *
 *   apiFetch("/api/profile")                    → GET, authed
 *   apiFetch("/api/profile", { method, body })  → any verb, authed
 *   apiUrl("/api/quran/chat")                   → absolute URL, for
 *                                                 situations that need
 *                                                 the raw fetch (SSE
 *                                                 streaming, multipart).
 *
 * Every call injects `Authorization: Bearer <supabase jwt>` when the user
 * is signed in. Public routes (like /api/quran/surahs) tolerate either a
 * missing token or a valid one — they just ignore it.
 *
 * Configuration:
 *   EXPO_PUBLIC_API_URL — e.g. "https://quranai-backend.vercel.app"
 *                          or "http://192.168.1.42:3000" in dev.
 */

import { Platform } from "react-native";

import { getAccessToken } from "@/lib/supabase";

/**
 * Base URL for the Next.js backend. Empty string means "same-origin",
 * which only works on web — on native the Expo bundle has no origin
 * concept so this MUST be set to an absolute URL.
 */
function getBaseUrl(): string {
  // New preferred env var — absolute URL to the Next.js backend.
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Back-compat with the old Replit bundle: if you still set
  // EXPO_PUBLIC_DOMAIN, we wrap it in https://. Delete this branch once
  // all environments have migrated.
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;

  // Fallback: same-origin (works on web dev against http://localhost:3000
  // when the Expo web build is served from the same host, which it
  // usually isn't — consider this a last resort).
  return "";
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getBaseUrl();
  const slash = path.startsWith("/") ? "" : "/";
  return `${base}${slash}${path}`;
}

export function getOllamaUrl(path: string): string {
  // Allow explicit override
  if (process.env.EXPO_PUBLIC_OLLAMA_URL) {
    console.warn(`[getOllamaUrl] Using EXPO_PUBLIC_OLLAMA_URL: ${process.env.EXPO_PUBLIC_OLLAMA_URL}`);
    const base = process.env.EXPO_PUBLIC_OLLAMA_URL.replace(/\/+$/, "");
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  // Derive from Next.js backend URL to ensure mobile devices hit the Mac host
  const base = getBaseUrl();
  const defaultOllamaIp = "http://192.168.110.80:11434";

  let origin = Platform.OS === 'android' ? defaultOllamaIp : defaultOllamaIp; // fallback

  if (base && base.includes("192.168.")) {
    // If we have a base URL, normally we'd extract the IP, but since the user
    // specified .80 for Ollama and .188 for the backend, we should just use .80
    origin = "http://192.168.110.80:11434";
  }

  const finalUrl = `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  console.warn(`[getOllamaUrl] Resolved to: ${finalUrl}`);
  return finalUrl;
}

export function getWhisperUrl(): string {
  if (process.env.EXPO_PUBLIC_WHISPER_URL) {
    const base = process.env.EXPO_PUBLIC_WHISPER_URL.replace(/\/+$/, "");
    return `${base}/transcribe`;
  }
  return "http://192.168.110.80:8000/transcribe";
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers ?? {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}

/** For debugging: log the configured base URL once on app boot. */
export function logApiConfig() {
  const base = getBaseUrl();
  if (!base) {
    console.warn(
      `[apiClient] No EXPO_PUBLIC_API_URL set — API calls from ${Platform.OS} will fail.`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(`[apiClient] Using API base URL: ${base}`);
  }
}
