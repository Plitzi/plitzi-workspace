import type { AiMode, AiProviderSettings, AiUsage } from '../types';
import type { ReactNode } from 'react';

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
  onHistoryOpen?: () => void;
  mode?: AiMode;
};

const usageColor = (pct: number) => {
  if (pct >= 80) {
    return 'bg-red-400 dark:bg-red-500';
  }
  if (pct >= 60) {
    return 'bg-amber-400 dark:bg-amber-500';
  }
  return 'bg-orange-400 dark:bg-orange-500';
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
  onSettingsToggle,
  onHistoryOpen,
  mode
}: AiChatHeaderProps) => {
  const { provider, model } = providerSettings ?? {};
  const modelLabel = model ? model.split('/').pop() : undefined;

  const accentDot = mode === 'plan' ? 'text-sky-500 dark:text-sky-400' : 'text-orange-500 dark:text-orange-400';
  const modePill =
    mode === 'plan'
      ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';

  const iconBtn =
    'flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300';

  return (
    <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={accentDot}>◆</span>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">AI</span>
          {mode && (
            <span
              className={`shrink-0 rounded px-1.5 py-px font-mono text-[9px] tracking-widest uppercase ${modePill}`}
            >
              {mode}
            </span>
          )}
          {badge && (
            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-px text-[9px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {extra}

          {modelLabel && (
            <span
              className="mr-1.5 shrink-0 font-mono text-[9px] text-zinc-400 dark:text-zinc-600"
              title={[provider, model].filter(Boolean).join(' / ')}
            >
              {modelLabel}
            </span>
          )}

          {onSettingsToggle && (
            <button
              onClick={onSettingsToggle}
              title="Provider settings"
              className={`${iconBtn} ${isSettingsOpen ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' : ''}`}
            >
              <i className="fa-solid fa-sliders text-[11px]" />
            </button>
          )}

          {onCompact && messageCount >= 2 && (
            <button onClick={onCompact} disabled={isStreaming} title="Compact conversation" className={iconBtn}>
              <i className="fa-solid fa-compress text-[11px]" />
            </button>
          )}

          {onHistoryOpen && (
            <button onClick={onHistoryOpen} title="Conversation history (⌘K)" className={iconBtn}>
              <i className="fa-solid fa-clock-rotate-left text-[11px]" />
            </button>
          )}

          <button onClick={onClear} disabled={isStreaming} title="New conversation" className={iconBtn}>
            <i className="fa-solid fa-plus text-[11px]" />
          </button>
        </div>
      </div>

      {usage && (
        <div className="flex items-center gap-2 px-3 pb-1.5">
          <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${usageColor(usage.usedPercent)}`}
              style={{ width: `${Math.min(usage.usedPercent, 100)}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
            {fmt(usage.inputTokens)}/{fmt(usage.contextLimit)}
          </span>
        </div>
      )}
    </div>
  );
};

export default AiChatHeader;
