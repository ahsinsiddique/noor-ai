import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getAccessToken, supabase } from "@/lib/supabase";
import { apiFetch } from "@/services/apiClient";

export type LearningLevel = "Beginner" | "Intermediate" | "Advanced";

export interface AuthUser {
  /** Supabase auth uuid — string, not number. */
  id: string;
  email: string;
  name: string;
  level: LearningLevel;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** Current Supabase JWT (null when signed out). Refreshes automatically. */
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    level: LearningLevel,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, level: LearningLevel) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => { },
  signup: async () => { },
  logout: async () => { },
  updateProfile: async () => { },
});

/**
 * Fetch the profile row (name + level) that lives in public.profiles.
 * Called after sign-in and after signup; falls back to sane defaults if
 * the row isn't there yet (e.g. the trigger hasn't fired).
 */
async function fetchProfile(id: string, email: string): Promise<AuthUser> {
  try {
    const res = await apiFetch("/api/profile");
    if (res.ok) {
      const data = (await res.json()) as { user: AuthUser };
      return data.user;
    }
  } catch {
    // Falls through
  }
  return { id, email, name: "", level: "Beginner" };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Bootstrap: read whatever session Supabase already has, then subscribe
  // to changes so we react to auto-refreshed tokens, other-tab sign-outs, etc.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session || cancelled) {
          if (!cancelled) setIsLoading(false);
          return;
        }
        const profile = await fetchProfile(session.user.id, session.user.email ?? "");
        if (cancelled) return;
        setToken(session.access_token);
        setUser(profile);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setToken(null);
        setUser(null);
        return;
      }
      setToken(session.access_token);
      // Only (re)fetch profile if we don't already have one for this user
      setUser((prev) =>
        prev && prev.id === session.user.id ? prev : null,
      );
      if (!user || user.id !== session.user.id) {
        const profile = await fetchProfile(session.user.id, session.user.email ?? "");
        setUser(profile);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error("No session returned");
    const profile = await fetchProfile(data.session.user.id, data.session.user.email ?? "");
    setToken(data.session.access_token);
    setUser(profile);
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string, level: LearningLevel) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // The `handle_new_user` trigger in Supabase reads these from
          // raw_user_meta_data and inserts the matching profile row.
          data: { name: name.trim(), level },
        },
      });
      if (error) throw new Error(error.message);

      // If email confirmation is enabled in Supabase, `session` may be null
      // here and the user needs to verify their email before they can log in.
      // We surface that condition via a clear error.
      console.log(data.user);
      if (!data.session) {
        throw new Error(
          data.user
            ? "Please check your email to confirm your account, then sign in."
            : "Signup failed",
        );
      }

      const token = await getAccessToken();
      setToken(token);
      setUser({
        id: data.session.user.id,
        email: data.session.user.email ?? email,
        name: name.trim(),
        level,
      });
    },
    [],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (name: string, level: LearningLevel) => {
      const res = await apiFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, level }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Update failed");
      }
      const data = (await res.json()) as { user: AuthUser };
      setUser(data.user);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading,
      login,
      signup,
      logout,
      updateProfile,
    }),
    [user, token, isLoading, login, signup, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
