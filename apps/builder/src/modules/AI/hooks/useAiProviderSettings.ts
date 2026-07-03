import { use, useCallback, useEffect, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { AiModelInfo, AiProviderSettings } from '../types';

const STORAGE_KEY = 'builder-state.aiChat.providerSettings';

const readStorage = (): AiProviderSettings => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AiProviderSettings;
  } catch {
    return {};
  }
};

const useAiProviderSettings = (enabled = false) => {
  const { server, webKey } = use(NetworkContext);
  const [settings, setSettings] = useState<AiProviderSettings>(readStorage);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | undefined>();

  // Fetch model list only when settings panel is open and provider is selected.
  useEffect(() => {
    if (!enabled || !settings.provider) {
      setModels([]);
      return;
    }

    let cancelled = false;
    setModelsLoading(true);
    setModelsError(undefined);

    fetch(`${server.aiServer}/ai/models?provider=${settings.provider}`, {
      headers: { Authorization: `Bearer ${webKey}` }
    })
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          const d = data as { models?: AiModelInfo[]; error?: string };
          setModels(d.models ?? []);
          setModelsError(d.error);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModels([]);
          setModelsError('Could not reach the server');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setModelsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, settings.provider, server.aiServer, webKey]);

  const updateSettings = useCallback((updates: Partial<AiProviderSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      // Reset model when switching providers — the previous model likely doesn't exist on the new one.
      if ('provider' in updates && updates.provider !== prev.provider) {
        delete next.model;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, models, modelsLoading, modelsError, updateSettings };
};

export default useAiProviderSettings;
