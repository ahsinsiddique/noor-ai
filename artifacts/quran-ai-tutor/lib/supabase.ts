/**
 * Supabase client for the Expo app.
 *
 * Configuration comes from Expo public env vars:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Session persistence uses AsyncStorage on native so users stay logged in
 * across app launches. On web we fall back to in-memory (localStorage would
 * also work but matches the old AuthContext's privacy-preserving behaviour
 * where web was never persistent).
 *
 * Important: we import `react-native-url-polyfill/auto` first. Supabase's
 * realtime client uses the WHATWG URL API which Hermes/JSC don't ship
 * natively on older RN versions.
 */

import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loudly in dev so misconfigured `.env` doesn't look like a login bug.
  console.warn(
    "[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — auth will fail.",
  );
}

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Supabase OAuth relies on URL-based callbacks which aren't meaningful
    // in a mobile app. We'll do email/password only for now.
    detectSessionInUrl: false,
  },
});

/**
 * Returns the current access token (JWT) or null.
 * Used by our API client to inject `Authorization: Bearer <token>` into
 * every request to the Next.js backend.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
