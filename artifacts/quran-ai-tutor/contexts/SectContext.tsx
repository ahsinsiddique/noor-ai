import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * The user's broad tradition — used on the server to frame prompts with
 * respect for the student's school. This is intentionally separate from
 * the madhhab selector (which is a Sunni sub-choice), so the two can
 * coexist: a Sunni user also picks a madhhab, a Shia user also picks a
 * sub-school (Ja'fari / Ismaili / Zaidi), etc.
 */

export type SectId = "sunni" | "shia" | "ibadi" | "general";

export interface SectMeta {
  id: SectId;
  name: string;
  shortName: string;
  description: string;
  /** Optional sub-schools the user can pick inside this tradition. */
  subSchools?: string[];
}

export const SECTS: SectMeta[] = [
  {
    id: "sunni",
    name: "Sunni",
    shortName: "Sunni",
    description:
      "Largest Muslim tradition. Follows one of the four madhhabs (Hanafi, Shafi'i, Maliki, Hanbali).",
  },
  {
    id: "shia",
    name: "Shia",
    shortName: "Shia",
    description:
      "Follows the narrations of the Ahl al-Bayt. Sub-schools include Ja'fari (Twelver), Ismaili, and Zaidi.",
    subSchools: ["Ja'fari (Twelver)", "Ismaili", "Zaidi"],
  },
  {
    id: "ibadi",
    name: "Ibadi",
    shortName: "Ibadi",
    description: "Predominant in Oman and parts of North Africa. Distinct hadith corpus and jurisprudence.",
  },
  {
    id: "general",
    name: "Non-denominational",
    shortName: "General",
    description:
      "No specific school. Focus on points of consensus across mainstream Muslim traditions.",
  },
];

export function getSectMeta(id: SectId): SectMeta {
  return SECTS.find((s) => s.id === id) ?? SECTS[0];
}

const STORAGE_KEY_SECT = "@quran_tutor_sect";
const STORAGE_KEY_SUBSCHOOL = "@quran_tutor_sect_subschool";

interface SectContextValue {
  sect: SectId | null;
  subSchool: string | null;
  setSect: (s: SectId) => void;
  setSubSchool: (s: string | null) => void;
  loaded: boolean;
}

const SectContext = createContext<SectContextValue>({
  sect: null,
  subSchool: null,
  setSect: () => {},
  setSubSchool: () => {},
  loaded: false,
});

export function SectProvider({ children }: { children: React.ReactNode }) {
  const [sect, setSectState] = useState<SectId | null>(null);
  const [subSchool, setSubSchoolState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY_SECT, STORAGE_KEY_SUBSCHOOL])
      .then(([[, rawSect], [, rawSub]]) => {
        if (rawSect && SECTS.some((s) => s.id === rawSect)) {
          setSectState(rawSect as SectId);
        }
        if (rawSub) setSubSchoolState(rawSub);
      })
      .finally(() => setLoaded(true));
  }, []);

  // Changing sect clears the sub-school if the new sect doesn't have one
  // that matches. Prevents stale sub-school values leaking between sects.
  const setSect = useCallback((s: SectId) => {
    setSectState(s);
    AsyncStorage.setItem(STORAGE_KEY_SECT, s).catch(() => {});
    const meta = getSectMeta(s);
    if (!meta.subSchools || meta.subSchools.length === 0) {
      setSubSchoolState(null);
      AsyncStorage.removeItem(STORAGE_KEY_SUBSCHOOL).catch(() => {});
    }
  }, []);

  const setSubSchool = useCallback((s: string | null) => {
    setSubSchoolState(s);
    if (s) AsyncStorage.setItem(STORAGE_KEY_SUBSCHOOL, s).catch(() => {});
    else AsyncStorage.removeItem(STORAGE_KEY_SUBSCHOOL).catch(() => {});
  }, []);

  const value = useMemo<SectContextValue>(
    () => ({ sect, subSchool, setSect, setSubSchool, loaded }),
    [sect, subSchool, setSect, setSubSchool, loaded],
  );

  return <SectContext.Provider value={value}>{children}</SectContext.Provider>;
}

export function useSect() {
  return useContext(SectContext);
}
