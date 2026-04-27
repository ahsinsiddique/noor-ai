import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "@quran_tutor_madhhab";

export type Madhhab = "Hanafi" | "Shafi'i" | "Maliki" | "Hanbali";

export const MADHHABS: Madhhab[] = ["Hanafi", "Shafi'i", "Maliki", "Hanbali"];

interface MadhhabContextValue {
  madhhab: Madhhab | null;
  setMadhhab: (m: Madhhab) => void;
  loaded: boolean;
}

const MadhhabContext = createContext<MadhhabContextValue>({
  madhhab: null,
  setMadhhab: () => {},
  loaded: false,
});

export function MadhhabProvider({ children }: { children: React.ReactNode }) {
  const [madhhab, setMadhhabState] = useState<Madhhab | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw && (MADHHABS as string[]).includes(raw)) {
          setMadhhabState(raw as Madhhab);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const setMadhhab = useCallback((m: Madhhab) => {
    setMadhhabState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  return (
    <MadhhabContext.Provider value={{ madhhab, setMadhhab, loaded }}>
      {children}
    </MadhhabContext.Provider>
  );
}

export function useMadhhab() {
  return useContext(MadhhabContext);
}
