import clsx from 'clsx';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

export type HeaderActionsProps = {
  isSettingsOpen?: boolean;
  onSettingsToggle?: () => void;
};

const HeaderActions = ({ isSettingsOpen, onSettingsToggle }: HeaderActionsProps) => {
  const { isStreaming, clearConversation: onClear } = useAiChatContext();
  return (
    <div className="flex shrink-0 items-center gap-0.5">
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
