import type { ReactNode } from 'react';
import type { AiProviderSettings, AiUsage } from '../types';

type AiChatHeaderProps = {
  onClear: () => void;
  onCompact?: () => void;
  isStreaming: boolean;
  messageCount?: number;
  badge?: string;
  extra?: ReactNode;
  providerSettings?: AiProviderSettings;
  usage?: AiUsage;
  isSettingsOpen?: boolean;
  onSettingsToggle?: () => void;
};

const usageColor = (pct: number) => {
  if (pct >= 80) return 'bg-red-400 dark:bg-red-500';
  if (pct >= 60) return 'bg-amber-400 dark:bg-amber-500';
  return 'bg-violet-400 dark:bg-violet-500';
};

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

const AiChatHeader = ({
  onClear,
  onCompact,
  isStreaming,
  messageCount = 0,
  badge,
  extra,
  providerSettings,
  usage,
  isSettingsOpen,
  onSettingsToggle
}: AiChatHeaderProps) => {
  const { provider, model } = providerSettings ?? {};
  const providerLabel = provider
    ? [provider, model ? model.split('/').pop() : undefined].filter(Boolean).join(' · ')
    : undefined;

  return (
    <div className="border-b border-gray-200 dark:border-zinc-800">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-violet-500 dark:text-violet-400">◆</span>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">AI Assistant</span>
          {badge && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {extra}

          {providerLabel && (
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{providerLabel}</span>
          )}

          {onSettingsToggle && (
            <button
              className={`text-xs transition-colors ${
                isSettingsOpen
                  ? 'text-violet-500 dark:text-violet-400'
                  : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400'
              }`}
              onClick={onSettingsToggle}
              title="Provider settings"
            >
              <i className="fa-solid fa-sliders" />
            </button>
          )}

          {onCompact && messageCount >= 2 && (
            <button
              className="text-xs text-zinc-400 transition-colors hover:text-amber-500 dark:text-zinc-600 dark:hover:text-amber-400"
              onClick={onCompact}
              disabled={isStreaming}
              title="Compact conversation (summarize to free context)"
            >
              ⊙ compact
            </button>
          )}

          <button
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
            onClick={onClear}
            disabled={isStreaming}
            title="New conversation"
          >
            ✕ new
          </button>
        </div>
      </div>

      {usage && (
        <div className="flex items-center gap-2 px-4 pb-1.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${usageColor(usage.usedPercent)}`}
              style={{ width: `${Math.min(usage.usedPercent, 100)}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
            {fmt(usage.inputTokens)} / {fmt(usage.contextLimit)}
          </span>
        </div>
      )}
    </div>
  );
};

export default AiChatHeader;
