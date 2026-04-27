import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/services/apiClient";

/**
 * Per-user locally-cached sessions, with best-effort cloud sync to Supabase
 * through the Next.js backend. Offline-first: every action touches local
 * AsyncStorage first, and the backend call is fire-and-forget. When the
 * network succeeds we remember the cloud UUID so subsequent messages and
 * summary updates can target the right row.
 *
 * IDs (important):
 *   session.id    — local string id (generated client-side, used everywhere)
 *   session.dbId  — remote UUID from Supabase (string; may be undefined)
 *   user.id       — Supabase auth UUID (string)
 */

function storageKey(userId: string | null | undefined): string {
  return userId ? `@quran_tutor_sessions:${userId}` : "@quran_tutor_sessions:guest";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  surahName: string;
  ayahNumber: number;
  date: number;
  messages: ChatMessage[];
  summary: string;
  score?: number;
  /** Supabase row UUID (set asynchronously after the initial POST succeeds). */
  dbId?: string;
}

interface SessionContextValue {
  sessions: Session[];
  currentSession: Session | null;
  startSession: (surahName: string, ayahNumber: number) => Session;
  addMessage: (sessionId: string, msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateSummary: (sessionId: string, summary: string, score?: number) => Promise<void>;
  updateSessionScore: (sessionId: string, score: number) => Promise<void>;
  clearCurrentSession: () => void;
  syncFromCloud: () => Promise<void>;
  loadSessionMessages: (sessionId: string, dbId: string) => Promise<void>;
  isLoadingCloud: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  sessions: [],
  currentSession: null,
  startSession: () => ({ id: "", surahName: "", ayahNumber: 0, date: 0, messages: [], summary: "" }),
  addMessage: () => {},
  updateSummary: async () => {},
  updateSessionScore: async () => {},
  clearCurrentSession: () => {},
  syncFromCloud: async () => {},
  loadSessionMessages: async () => {},
  isLoadingCloud: false,
});

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

/** Backend row shape — snake_case straight from Postgres via Supabase. */
interface DbSession {
  id: string;
  user_id: string;
  surah_name: string;
  ayah_number: number;
  summary: string;
  score: number | null;
  created_at: string;
  updated_at?: string;
}

interface DbMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

// Map local session id → remote UUID. Set when POST /api/sessions resolves.
type DbIdMap = Map<string, string>;
// Messages queued before dbId is known, flushed when it arrives.
type PendingMsg = { role: "user" | "assistant"; content: string };
type PendingMap = Map<string, PendingMsg[]>;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const dbIdMap = useRef<DbIdMap>(new Map());
  const pendingMessages = useRef<PendingMap>(new Map());

  // Load sessions for the current user from local storage. On user change
  // (login / logout) reset everything to the new user's data.
  useEffect(() => {
    const key = storageKey(user?.id);
    dbIdMap.current = new Map();
    pendingMessages.current = new Map();
    setCurrentSession(null);

    AsyncStorage.getItem(key)
      .then((raw) => {
        const loaded: Session[] = raw ? (JSON.parse(raw) as Session[]) : [];
        setSessions(loaded);
        loaded.forEach((s) => { if (s.dbId) dbIdMap.current.set(s.id, s.dbId); });
      })
      .catch(() => setSessions([]));
  }, [user?.id]);

  const patchSessionDbId = useCallback(
    (sessionId: string, dbId: string, uid: string | null | undefined) => {
      dbIdMap.current.set(sessionId, dbId);
      setSessions((prev) => {
        const updated = prev.map((s) => (s.id === sessionId ? { ...s, dbId } : s));
        AsyncStorage.setItem(storageKey(uid), JSON.stringify(updated)).catch(() => {});
        return updated;
      });
      setCurrentSession((prev) => {
        if (!prev || prev.id !== sessionId) return prev;
        return { ...prev, dbId };
      });
      // Flush buffered messages
      const pending = pendingMessages.current.get(sessionId);
      if (pending?.length) {
        pendingMessages.current.delete(sessionId);
        for (const msg of pending) {
          apiFetch(`/api/sessions/${dbId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(msg),
          }).catch(() => {});
        }
      }
    },
    [],
  );

  const startSession = useCallback(
    (surahName: string, ayahNumber: number): Session => {
      const session: Session = {
        id: generateId(),
        surahName,
        ayahNumber,
        date: Date.now(),
        messages: [],
        summary: "",
      };
      setCurrentSession(session);
      setSessions((prev) => {
        const updated = [session, ...prev];
        AsyncStorage.setItem(storageKey(user?.id), JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      // Fire-and-forget: create the row in the cloud.
      if (token) {
        const uid = user?.id;
        apiFetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ surahName, ayahNumber }),
        })
          .then((res) => (res.ok ? (res.json() as Promise<{ session: DbSession }>) : null))
          .then((data) => {
            if (data?.session?.id) patchSessionDbId(session.id, data.session.id, uid);
          })
          .catch(() => {});
      }

      return session;
    },
    [token, user?.id, patchSessionDbId],
  );

  const addMessage = useCallback(
    (sessionId: string, msg: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMsg: ChatMessage = { ...msg, id: generateId(), timestamp: Date.now() };

      setCurrentSession((prev) => {
        if (!prev || prev.id !== sessionId) return prev;
        return { ...prev, messages: [...prev.messages, newMsg] };
      });

      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, newMsg] } : s,
        );
        AsyncStorage.setItem(storageKey(user?.id), JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      if (token) {
        const dbId = dbIdMap.current.get(sessionId);
        if (dbId) {
          apiFetch(`/api/sessions/${dbId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: msg.role, content: msg.content }),
          }).catch(() => {});
        } else {
          const queue = pendingMessages.current.get(sessionId) ?? [];
          queue.push({ role: msg.role, content: msg.content });
          pendingMessages.current.set(sessionId, queue);
        }
      }
    },
    [token, user?.id],
  );

  const updateSummary = useCallback(
    async (sessionId: string, summary: string, score?: number): Promise<void> => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, summary, score: score ?? s.score } : s,
        );
        AsyncStorage.setItem(storageKey(user?.id), JSON.stringify(updated)).catch(() => {});
        return updated;
      });
      setCurrentSession((prev) => {
        if (!prev || prev.id !== sessionId) return prev;
        return { ...prev, summary, score: score ?? prev.score };
      });
      if (token) {
        const dbId = dbIdMap.current.get(sessionId);
        if (dbId) {
          const body: Record<string, unknown> = { summary };
          if (score !== undefined) body.score = score;
          apiFetch(`/api/sessions/${dbId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }).catch(() => {});
        }
      }
    },
    [token, user?.id],
  );

  const updateSessionScore = useCallback(
    async (sessionId: string, score: number): Promise<void> => {
      setSessions((prev) => {
        const updated = prev.map((s) => (s.id === sessionId ? { ...s, score } : s));
        AsyncStorage.setItem(storageKey(user?.id), JSON.stringify(updated)).catch(() => {});
        return updated;
      });
      setCurrentSession((prev) => {
        if (!prev || prev.id !== sessionId) return prev;
        return { ...prev, score };
      });
      if (token) {
        const dbId = dbIdMap.current.get(sessionId);
        if (dbId) {
          apiFetch(`/api/sessions/${dbId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score }),
          }).catch(() => {});
        }
      }
    },
    [token, user?.id],
  );

  const clearCurrentSession = useCallback(() => setCurrentSession(null), []);

  const syncFromCloud = useCallback(async (): Promise<void> => {
    if (!token) return;
    setIsLoadingCloud(true);
    try {
      const res = await apiFetch("/api/sessions");
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: DbSession[] };

      const cloudSessions: Session[] = data.sessions.map((s) => ({
        id: `cloud-${s.id}`,
        dbId: s.id,
        surahName: s.surah_name,
        ayahNumber: s.ayah_number,
        date: new Date(s.created_at).getTime(),
        messages: [],
        summary: s.summary,
        score: s.score ?? undefined,
      }));

      cloudSessions.forEach((s) => {
        if (s.dbId) dbIdMap.current.set(s.id, s.dbId);
      });

      setSessions((local) => {
        const cloudDbIds = new Set(cloudSessions.map((s) => s.dbId));
        const localOnly = local.filter((s) => !s.dbId || !cloudDbIds.has(s.dbId));
        const merged = [...cloudSessions, ...localOnly].sort((a, b) => b.date - a.date);
        AsyncStorage.setItem(storageKey(user?.id), JSON.stringify(merged)).catch(() => {});
        return merged;
      });
    } catch {
      // Network error — keep local data
    } finally {
      setIsLoadingCloud(false);
    }
  }, [token, user?.id]);

  const loadSessionMessages = useCallback(
    async (sessionId: string, dbId: string): Promise<void> => {
      if (!token) return;
      try {
        const res = await apiFetch(`/api/sessions/${dbId}/messages`);
        if (!res.ok) return;
        const data = (await res.json()) as { messages: DbMessage[] };
        const loaded: ChatMessage[] = data.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at).getTime(),
        }));
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, messages: loaded } : s)),
        );
      } catch {
        // Network error — messages remain empty
      }
    },
    [token],
  );

  return (
    <SessionContext.Provider
      value={{
        sessions,
        currentSession,
        startSession,
        addMessage,
        updateSummary,
        updateSessionScore,
        clearCurrentSession,
        syncFromCloud,
        loadSessionMessages,
        isLoadingCloud,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessions() {
  return useContext(SessionContext);
}
