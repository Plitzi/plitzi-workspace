import clsx from 'clsx';

import { useAiChatContext } from '../contexts/AiChatContext';

import type { AiMode, AiProviderSettings, AiUsage } from '../types';

type AiChatHeaderProps = {
  onClear: () => void;
  onCompact?: () => void;
  isStreaming: boolean;
  messageCount?: number;
  providerSettings?: AiProviderSettings;
  usage?: AiUsage;
  isSettingsOpen?: boolean;
  onSettingsToggle?: () => void;
  onHistoryOpen?: () => void;
  mode?: AiMode;
  conversationTitle?: string;
};

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

const iconBtn =
  'w-6.5 h-6.5 grid place-items-center rounded-md border-0 cursor-pointer transition-colors disabled:opacity-35 bg-transparent text-zinc-500 dark:text-zinc-400 hover:bg-neutral-100 dark:hover:bg-zinc-800';

const AiChatHeader = ({
  onClear,
  onCompact,
  isStreaming,
  messageCount = 0,
  providerSettings,
  usage,
  isSettingsOpen,
  onSettingsToggle,
  onHistoryOpen,
  mode,
  conversationTitle
}: AiChatHeaderProps) => {
  const { currentMode } = useAiChatContext();
  const { provider, model } = providerSettings ?? {};
  const modelLabel = model ? model.split('/').pop() : undefined;

  return (
    <div className="shrink-0 border-b border-neutral-200 bg-neutral-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Brand mark */}
        <div
          className={clsx(
            'grid h-5.5 w-5.5 shrink-0 place-items-center rounded-[5px] border border-neutral-300 bg-neutral-50 font-mono text-[10px] font-bold dark:border-zinc-700 dark:bg-zinc-800',
            {
              'text-emerald-500 dark:text-emerald-400': currentMode === 'build',
              'text-sky-500 dark:text-sky-400': currentMode === 'plan'
            }
          )}
        >
          P
        </div>

        <span className="shrink-0 font-mono text-[11.5px] font-semibold text-zinc-900 dark:text-zinc-100">
          Plitzi<span className="font-normal text-zinc-500 dark:text-zinc-400"> · Agent</span>
        </span>

        {onHistoryOpen ? (
          <button
            onClick={onHistoryOpen}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-left transition-colors hover:border-neutral-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
          >
            <span
              className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', {
                'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
                'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
              })}
            />
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
              {conversationTitle ?? 'New conversation'}
            </span>
            {mode && (
              <span
                className={clsx('shrink-0 rounded border px-1.5 py-px font-mono text-[8px] tracking-wider uppercase', {
                  'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-400':
                    currentMode === 'build',
                  'border-sky-500/50 bg-sky-500/10 text-sky-500 dark:border-sky-400/50 dark:bg-sky-400/10 dark:text-sky-400':
                    currentMode === 'plan'
                })}
              >
                {mode}
              </span>
            )}
            <kbd className="shrink-0 rounded border border-b-2 border-neutral-300 bg-neutral-100 px-1 py-px font-mono text-[8px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              ⌘K
            </kbd>
          </button>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          {modelLabel && (
            <span
              className="mr-1 font-mono text-[9px] text-zinc-400 dark:text-zinc-600"
              title={[provider, model].filter(Boolean).join(' / ')}
            >
              {modelLabel}
            </span>
          )}

          {onSettingsToggle && (
            <button
              onClick={onSettingsToggle}
              title="Provider settings"
              className={clsx(
                iconBtn,
                isSettingsOpen && 'bg-neutral-50 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              )}
            >
              <i className="fa-solid fa-sliders text-[10px]" />
            </button>
          )}

          {onCompact && messageCount >= 2 && (
            <button onClick={onCompact} disabled={isStreaming} title="Compact conversation" className={iconBtn}>
              <i className="fa-solid fa-compress text-[10px]" />
            </button>
          )}

          <button onClick={onClear} disabled={isStreaming} title="New conversation" className={iconBtn}>
            <i className="fa-solid fa-plus text-[10px]" />
          </button>
        </div>
      </div>

      {usage && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-zinc-800">
            <div
              className={clsx('h-full rounded-full transition-all', {
                'bg-pink-500 dark:bg-pink-400': usage.usedPercent >= 80,
                'bg-yellow-500 dark:bg-yellow-400': usage.usedPercent >= 60 && usage.usedPercent < 80,
                'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build' && usage.usedPercent < 60,
                'bg-sky-500 dark:bg-sky-400': currentMode === 'plan' && usage.usedPercent < 60
              })}
              style={{ width: `${Math.min(usage.usedPercent, 100)}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[9px] text-zinc-500 dark:text-zinc-400">
            {fmt(usage.inputTokens)}/{fmt(usage.contextLimit)}
          </span>
        </div>
      )}
    </div>
  );
};

export default AiChatHeader;
