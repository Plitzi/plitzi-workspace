import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { useCallback, useMemo } from 'react';

import { BASE_URL_PLACEHOLDER, PROVIDERS } from './helpers/constants';
import groupModels from './helpers/groupModels';

import type { AiModelInfo, AiProviderSettings, AiProviderType } from '../../types';

export type AiProviderSettingsProps = {
  settings: AiProviderSettings;
  models: AiModelInfo[];
  modelsLoading: boolean;
  modelsError?: string;
  onChange: (updates: Partial<AiProviderSettings>) => void;
};

const AiProviderSettings = ({ settings, models, modelsLoading, modelsError, onChange }: AiProviderSettingsProps) => {
  const { provider, model, apiKey, baseUrl } = settings;
  const groupedOptions = useMemo(() => groupModels(models), [models]);
  const needsKey = provider && provider !== 'ollama';
  const needsBaseUrl = provider === 'ollama' || provider === 'opencode';

  const handleChangeProvider = useCallback(
    (value: string) => onChange({ provider: (value || undefined) as AiProviderType | undefined }),
    [onChange]
  );

  const handleChangeModel = useCallback(
    (opt: unknown) => onChange({ model: opt ? (opt as { value: string }).value : undefined }),
    [onChange]
  );

  const handleChangeApiKey = useCallback((v: string) => onChange({ apiKey: v || undefined }), [onChange]);
  const handleChangeBaseUrl = useCallback((v: string) => onChange({ baseUrl: v || undefined }), [onChange]);

  return (
    <div className="border-b border-violet-100 bg-violet-50/40 px-4 py-3 dark:border-violet-900/30 dark:bg-violet-950/20">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Select
            label="Provider"
            size="xs"
            value={provider ?? ''}
            placeholder="Server Default"
            className="grow basis-0"
            onChange={handleChangeProvider}
          >
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>

          {provider && (
            <div className="min-w-0 grow basis-0">
              <Select2
                size="xs"
                label="Model"
                value={model ? { value: model, label: model } : undefined}
                options={groupedOptions}
                loading={modelsLoading}
                placeholder={provider === 'opencode' ? 'e.g. anthropic/claude-sonnet-4-6' : 'Select a model'}
                error={modelsError && !modelsLoading ? modelsError : undefined}
                onChange={handleChangeModel}
              />
            </div>
          )}
        </div>

        {needsKey && (
          <Input
            label={provider === 'opencode' ? 'Password (optional)' : 'API Key (optional)'}
            type="password"
            value={apiKey ?? ''}
            placeholder="Use server default"
            autoComplete="off"
            spellCheck={false}
            size="xs"
            onChange={handleChangeApiKey}
          />
        )}

        {needsBaseUrl && (
          <Input
            label="Base URL (optional)"
            type="text"
            value={baseUrl ?? ''}
            placeholder={BASE_URL_PLACEHOLDER[provider]}
            autoComplete="off"
            spellCheck={false}
            size="xs"
            onChange={handleChangeBaseUrl}
          />
        )}
      </div>
    </div>
  );
};

export default AiProviderSettings;
