import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AI_PROVIDERS,
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER,
  type ProviderId,
  getModel,
  getProvider,
} from "@/data/aiModels";

/**
 * Persists the user's chosen AI provider (openai / xai) and model id across
 * app launches. Everywhere else in the app reads { provider, modelId } out
 * of this context and sends them to the server as `provider` + `model`.
 */

const STORAGE_KEY = "@quran_tutor_ai_model";

interface StoredShape {
  provider: ProviderId;
  modelId: string;
}

interface ModelContextValue {
  provider: ProviderId;
  modelId: string;
  providerMeta: ReturnType<typeof getProvider>;
  modelMeta: ReturnType<typeof getModel>;
  setProvider: (p: ProviderId) => void;
  setModel: (p: ProviderId, modelId: string) => void;
  loaded: boolean;
}

const ModelContext = createContext<ModelContextValue>({
  provider: DEFAULT_PROVIDER,
  modelId: DEFAULT_MODEL_ID,
  providerMeta: getProvider(DEFAULT_PROVIDER),
  modelMeta: getModel(DEFAULT_PROVIDER, DEFAULT_MODEL_ID),
  setProvider: () => {},
  setModel: () => {},
  loaded: false,
});

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProviderState] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [modelId, setModelIdState] = useState<string>(DEFAULT_MODEL_ID);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as Partial<StoredShape>;
          const p = AI_PROVIDERS.find((x) => x.id === parsed.provider);
          if (!p) return;
          const m = p.models.find((x) => x.id === parsed.modelId);
          setProviderState(p.id);
          setModelIdState(m?.id ?? p.models[0].id);
        } catch {
          // corrupted storage — ignore and stay on defaults
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback((p: ProviderId, m: string) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: p, modelId: m })).catch(
      () => {},
    );
  }, []);

  // Changing provider resets to that provider's first model — otherwise we'd
  // be sending a model id that belongs to a different provider.
  const setProvider = useCallback(
    (p: ProviderId) => {
      const prov = getProvider(p);
      const firstModel = prov.models[0].id;
      setProviderState(p);
      setModelIdState(firstModel);
      persist(p, firstModel);
    },
    [persist],
  );

  const setModel = useCallback(
    (p: ProviderId, m: string) => {
      setProviderState(p);
      setModelIdState(m);
      persist(p, m);
    },
    [persist],
  );

  const providerMeta = useMemo(() => getProvider(provider), [provider]);
  const modelMeta = useMemo(() => getModel(provider, modelId), [provider, modelId]);

  const value = useMemo<ModelContextValue>(
    () => ({ provider, modelId, providerMeta, modelMeta, setProvider, setModel, loaded }),
    [provider, modelId, providerMeta, modelMeta, setProvider, setModel, loaded],
  );

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

export function useModel() {
  return useContext(ModelContext);
}
