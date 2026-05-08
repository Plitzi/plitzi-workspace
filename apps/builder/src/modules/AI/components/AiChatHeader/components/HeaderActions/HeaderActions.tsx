import clsx from 'clsx';

import type { AiProviderSettings } from '@pmodules/AI/types';

export type HeaderActionsProps = {
  providerSettings?: AiProviderSettings;
  isSettingsOpen?: boolean;
  onSettingsToggle?: () => void;
  messageCount: number;
  isStreaming: boolean;
  onCompact?: () => void;
  onClear: () => void;
};

const HeaderActions = ({
  providerSettings,
  isSettingsOpen,
  onSettingsToggle,
  messageCount,
  isStreaming,
  onCompact,
  onClear
}: HeaderActionsProps) => {
  const { provider, model } = providerSettings ?? {};
  const modelLabel = model ? model.split('/').pop() : undefined;

  return (
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
            'grid h-6.5 w-6.5 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-zinc-500 transition-colors hover:bg-neutral-100 disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-800',
            { 'bg-neutral-50 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100': isSettingsOpen }
          )}
        >
          <i className="fa-solid fa-sliders text-[10px]" />
        </button>
      )}

      {onCompact && messageCount >= 2 && (
        <button
          onClick={onCompact}
          disabled={isStreaming}
          title="Compact conversation"
          className="grid h-6.5 w-6.5 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-zinc-500 transition-colors hover:bg-neutral-100 disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <i className="fa-solid fa-compress text-[10px]" />
        </button>
      )}

      <button
        onClick={onClear}
        disabled={isStreaming}
        title="New conversation"
        className="grid h-6.5 w-6.5 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-zinc-500 transition-colors hover:bg-neutral-100 disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <i className="fa-solid fa-plus text-[10px]" />
      </button>
    </div>
  );
};

export default HeaderActions;
