import { useQuery } from "@tanstack/react-query";

import { apiUrl } from "@/services/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface LiveAyah {
  arabic: string;
  translation: string;
  numberInSurah: number;
  globalNumber: number;
  surahName: string;
  surahArabic: string;
  totalAyahs: number;
  audioUrl: string;
}

// ─── Fetch functions ──────────────────────────────────────────────────────────
// These endpoints are public on the backend (surahs list, individual ayahs)
// and don't need auth.

export async function fetchSurahList(): Promise<SurahMeta[]> {
  const res = await fetch(apiUrl("/api/quran/surahs"));
  if (!res.ok) throw new Error("Failed to fetch surah list");
  const data = (await res.json()) as { surahs: SurahMeta[] };
  return data.surahs;
}

export async function fetchAyah(
  surahNumber: number,
  ayahNumber: number,
  edition = "en.asad",
): Promise<LiveAyah> {
  const res = await fetch(
    apiUrl(`/api/quran/ayah/${surahNumber}/${ayahNumber}?edition=${encodeURIComponent(edition)}`),
  );
  if (!res.ok) throw new Error("Failed to fetch ayah");
  const data = (await res.json()) as { ayah: LiveAyah };
  return data.ayah;
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export function useSurahList() {
  return useQuery({
    queryKey: ["surahList"],
    queryFn: fetchSurahList,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

export function useAyah(surahNumber: number, ayahNumber: number, edition = "en.asad") {
  return useQuery({
    queryKey: ["ayah", surahNumber, ayahNumber, edition],
    queryFn: () => fetchAyah(surahNumber, ayahNumber, edition),
    staleTime: 60 * 60 * 1000,
    retry: 2,
    enabled: surahNumber > 0 && ayahNumber > 0,
  });
}
