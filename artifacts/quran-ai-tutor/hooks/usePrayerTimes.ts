import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";

export type Prayer = {
  name: string;
  arabic: string;
  emoji: string;
  time: string;
  timestamp: number;
};

export type PrayerTimesState = {
  prayers: Prayer[];
  nextPrayer: Prayer | null;
  minutesUntilNext: number;
  locationName: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const PRAYER_NAMES = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
const ARABIC: Record<string, string> = {
  Fajr: "الفجر",
  Sunrise: "الشروق",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};
const EMOJI: Record<string, string> = {
  Fajr: "🌙",
  Sunrise: "🌄",
  Dhuhr: "☀️",
  Asr: "🌤️",
  Maghrib: "🌅",
  Isha: "🌃",
};

const CACHE_KEY = "@prayer_times_cache";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type CacheEntry = {
  date: string;       // "YYYY-MM-DD"
  fetchedAt: number;  // timestamp
  prayers: Omit<Prayer, "timestamp">[];
  locationName: string;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function toTimestamp(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function hydrateTimestamps(raw: Omit<Prayer, "timestamp">[]): Prayer[] {
  return raw.map((p) => ({ ...p, timestamp: toTimestamp(p.time) }));
}

export function usePrayerTimes(enabled = true): PrayerTimesState {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [locationName, setLocationName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // ── Try cache first ────────────────────────────────────────────────
        const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          const now = Date.now();
          const fresh = entry.date === todayStr() && now - entry.fetchedAt < CACHE_TTL_MS;
          if (fresh && !cancelled) {
            setPrayers(hydrateTimestamps(entry.prayers));
            setLocationName(entry.locationName);
            setLoading(false);
            return;
          }
        }

        // ── Location permission ────────────────────────────────────────────
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) {
            setError("Location permission denied. Enable location to see prayer times.");
            setLoading(false);
          }
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;

        // ── Fetch prayer times + reverse geocode in parallel ───────────────
        const [timingsRes, geocodeRes] = await Promise.allSettled([
          fetch(`https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=2`),
          Location.reverseGeocodeAsync({ latitude, longitude }),
        ]);

        if (cancelled) return;

        if (timingsRes.status === "rejected") throw new Error("Could not fetch prayer times");

        const data = await timingsRes.value.json();
        if (!data?.data?.timings) throw new Error("Invalid prayer times response");

        const timings: Record<string, string> = data.data.timings;
        const rawPrayers: Omit<Prayer, "timestamp">[] = PRAYER_NAMES.map((name) => ({
          name,
          arabic: ARABIC[name],
          emoji: EMOJI[name],
          time: (timings[name] ?? "00:00").replace(/\s*\(.*\)/, ""),
        }));

        const locName =
          geocodeRes.status === "fulfilled" && geocodeRes.value.length > 0
            ? [geocodeRes.value[0].city ?? geocodeRes.value[0].district, geocodeRes.value[0].country]
                .filter(Boolean)
                .join(", ")
            : "";

        // ── Persist to cache ───────────────────────────────────────────────
        const entry: CacheEntry = {
          date: todayStr(),
          fetchedAt: Date.now(),
          prayers: rawPrayers,
          locationName: locName,
        };
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry)).catch(() => {});

        if (!cancelled) {
          setPrayers(hydrateTimestamps(rawPrayers));
          setLocationName(locName);
          setLoading(false);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError((e as Error).message ?? "Failed to load prayer times");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tick, enabled]);

  const now = Date.now();
  const nextPrayer = useMemo(
    () => prayers.find((p) => p.timestamp > now) ?? prayers[0] ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prayers]
  );
  const minutesUntilNext = useMemo(
    () => (nextPrayer ? Math.max(0, Math.round((nextPrayer.timestamp - now) / 60000)) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nextPrayer]
  );

  return { prayers, nextPrayer, minutesUntilNext, locationName, loading, error, refetch };
}
