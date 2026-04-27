import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "@quran_tutor_feature_config";

export interface FeatureConfig {
  showPrayerTimes: boolean;
  showTeacherSelection: boolean;
  showAnalytics: boolean;
}

const DEFAULTS: FeatureConfig = {
  showPrayerTimes: false,
  showTeacherSelection: false,
  showAnalytics: false,
};

interface FeatureConfigContextValue {
  config: FeatureConfig;
  setFeature: (key: keyof FeatureConfig, value: boolean) => void;
}

const FeatureConfigContext = createContext<FeatureConfigContextValue>({
  config: DEFAULTS,
  setFeature: () => {},
});

export function FeatureConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<FeatureConfig>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<FeatureConfig>;
            setConfig((prev) => ({ ...prev, ...parsed }));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const setFeature = useCallback((key: keyof FeatureConfig, value: boolean) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <FeatureConfigContext.Provider value={{ config, setFeature }}>
      {children}
    </FeatureConfigContext.Provider>
  );
}

export function useFeatureConfig() {
  return useContext(FeatureConfigContext);
}
