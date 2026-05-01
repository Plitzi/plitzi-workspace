import { useMemo } from 'react';

import type { AiModelInfo, AiProviderSettings, AiProviderType } from '../../types';
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

const groupByProvider = (models: AiModelInfo[]): { providerName: string; models: AiModelInfo[] }[] => {
  const map = new Map<string, AiModelInfo[]>();
  for (const m of models) {
    const key = m.providerName ?? 'Other';
    const group = map.get(key) ?? [];
    group.push(m);
    map.set(key, group);
  }
  return Array.from(map.entries()).map(([providerName, models]) => ({ providerName, models }));
};

const AiProviderSettings = ({ settings, models, modelsLoading, modelsError, onChange }: AiProviderSettingsProps) => {
  const { provider, model, apiKey, baseUrl } = settings;
  const grouped = useMemo(() => groupByProvider(models), [models]);
  const needsKey = provider && provider !== 'ollama';
  const needsBaseUrl = provider === 'ollama' || provider === 'opencode';

  return (
    <div className="border-b border-violet-100 bg-violet-50/40 px-4 py-3 dark:border-violet-900/30 dark:bg-violet-950/20">
      <div className="flex flex-col gap-2">
        {/* Provider + Model row */}
        <div className="flex gap-2">
          <div className="flex-1">
            <span className={labelCls}>Provider</span>
            <select
              className={inputCls}
              value={provider ?? ''}
              onChange={e => onChange({ provider: (e.target.value || undefined) as AiProviderType | undefined })}
            >
              <option value="">Server default</option>
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {provider && (
            <div className="flex-1">
              <span className={labelCls}>Model</span>
              <input
                type="text"
                list="ai-model-list"
                className={inputCls}
                value={model ?? ''}
                placeholder={
                  modelsLoading ? 'Loading…' : provider === 'opencode' ? 'e.g. anthropic/claude-sonnet-4-6' : 'Default'
                }
                disabled={modelsLoading}
                onChange={e => onChange({ model: e.target.value || undefined })}
                spellCheck={false}
              />
              <datalist id="ai-model-list">
                {grouped.flatMap(({ providerName, models: group }) =>
                  group.map(m => (
                    <option
                      key={m.id}
                      value={m.id}
                      label={`${providerName} · ${m.name}${m.free === true ? ' (free)' : ''}`}
                    />
                  ))
                )}
              </datalist>
              {modelsError && !modelsLoading && (
                <span className="mt-0.5 block text-[10px] text-red-400 dark:text-red-500">{modelsError}</span>
              )}
            </div>
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
