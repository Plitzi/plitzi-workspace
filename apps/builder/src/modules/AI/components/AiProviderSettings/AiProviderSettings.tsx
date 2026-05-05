import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { useCallback, useMemo } from 'react';

import type { AiModelInfo, AiProviderSettings, AiProviderType } from '../../types';
import type { OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { ChangeEvent } from 'react';

const PROVIDERS: { value: AiProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'opencode', label: 'OpenCode' }
];

const BASE_URL_PLACEHOLDER: Partial<Record<AiProviderType, string>> = {
  ollama: 'http://localhost:11434/v1',
  opencode: 'http://localhost:4096'
};

const inputCls =
  'w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:focus:border-violet-500';

const labelCls = 'mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500';

type Field = {
  label: string;
  type: 'text' | 'password';
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
};

const SettingsField = ({ label, type, value, placeholder, onChange }: Field) => (
  <div>
    <span className={labelCls}>{label}</span>
    <input
      type={type}
      className={inputCls}
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      autoComplete="off"
      spellCheck={false}
    />
  </div>
);

export type AiProviderSettingsProps = {
  settings: AiProviderSettings;
  models: AiModelInfo[];
  modelsLoading: boolean;
  modelsError?: string;
  onChange: (updates: Partial<AiProviderSettings>) => void;
};

const groupModels = (models: AiModelInfo[]): OptionGroup[] => {
  const map = new Map<string, AiModelInfo[]>();
  for (const m of models) {
    const key = m.providerName ?? 'Other';
    const group = map.get(key) ?? [];
    group.push(m);
    map.set(key, group);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, models]) => ({
      label,
      options: models.map(m => ({
        value: m.id,
        label: `${m.name}${m.free === true ? ' (free)' : ''}`
      }))
    }));
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

  return (
    <div className="border-b border-violet-100 bg-violet-50/40 px-4 py-3 dark:border-violet-900/30 dark:bg-violet-950/20">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <Select
              label="Provider"
              size="xs"
              value={provider ?? ''}
              placeholder="Server Default"
              onChange={handleChangeProvider}
            >
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {provider && (
            <Select2
              size="xs"
              label="Model"
              value={model ? { value: model, label: model } : undefined}
              options={groupedOptions}
              loading={modelsLoading}
              placeholder={provider === 'opencode' ? 'e.g. anthropic/claude-sonnet-4-6' : 'Select a model'}
              error={modelsError && !modelsLoading ? modelsError : undefined}
              onChange={opt => onChange({ model: opt ? (opt as { value: string }).value : undefined })}
            />
          )}
        </div>

        {/* API Key */}
        {needsKey && (
          <SettingsField
            label={provider === 'opencode' ? 'Password (optional)' : 'API Key (optional)'}
            type="password"
            value={apiKey ?? ''}
            placeholder="Use server default"
            onChange={v => onChange({ apiKey: v || undefined })}
          />
        )}

        {/* Base URL */}
        {needsBaseUrl && (
          <SettingsField
            label="Base URL (optional)"
            type="text"
            value={baseUrl ?? ''}
            placeholder={BASE_URL_PLACEHOLDER[provider]}
            onChange={v => onChange({ baseUrl: v || undefined })}
          />
        )}
      </div>
    </div>
  );
};

export default AiProviderSettings;
