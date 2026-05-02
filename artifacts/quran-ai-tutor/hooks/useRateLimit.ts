import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import { FREE_DAILY_AI_CALLS } from "@/config/limits";

const KEY_DATE = "@noorai_guest_date";
const KEY_COUNT = "@noorai_guest_calls";

function todayString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

interface RateLimitState {
  remaining: number;
  isLimited: boolean;
  isLoaded: boolean;
  recordCall: () => Promise<void>;
  resetForTest: () => Promise<void>;
}

/**
 * Daily AI call limiter for unauthenticated (guest) users.
 * When `enabled` is false (i.e. user is logged in) no limits apply.
 */
export function useRateLimit({ enabled }: { enabled: boolean }): RateLimitState {
  const [count, setCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!enabled) { setIsLoaded(true); return; }
    if (loadedRef.current) return;
    loadedRef.current = true;

    void (async () => {
      const [storedDate, storedCount] = await Promise.all([
        AsyncStorage.getItem(KEY_DATE),
        AsyncStorage.getItem(KEY_COUNT),
      ]);
      const today = todayString();
      if (storedDate !== today) {
        // New day — reset counter
        await AsyncStorage.multiSet([[KEY_DATE, today], [KEY_COUNT, "0"]]);
        setCount(0);
      } else {
        setCount(Number(storedCount ?? "0"));
      }
      setIsLoaded(true);
    })();
  }, [enabled]);

  const recordCall = useCallback(async () => {
    if (!enabled) return;
    const next = count + 1;
    setCount(next);
    await AsyncStorage.setItem(KEY_COUNT, String(next));
  }, [enabled, count]);

  const resetForTest = useCallback(async () => {
    await AsyncStorage.multiSet([[KEY_DATE, todayString()], [KEY_COUNT, "0"]]);
    setCount(0);
  }, []);

  if (!enabled) {
    return {
      remaining: Infinity,
      isLimited: false,
      isLoaded: true,
      recordCall: async () => {},
      resetForTest,
    };
  }

  const remaining = Math.max(0, FREE_DAILY_AI_CALLS - count);
  return { remaining, isLimited: remaining === 0, isLoaded, recordCall, resetForTest };
}