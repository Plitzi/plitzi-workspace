import clsx from 'clsx';

import ConversationButton from './components/ConversationButton';
import HeaderActions from './components/HeaderActions';
import UsageBar from './components/UsageBar';
import { useAiChatContext } from '../../contexts/AiChatContext';

import type { AiMode, AiProviderSettings, AiUsage } from '../../types';

export type AiChatHeaderProps = {
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

  return (
    <div className="shrink-0 border-b border-neutral-200 bg-neutral-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 px-3 py-2.5">
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

        {onHistoryOpen && (
          <ConversationButton conversationTitle={conversationTitle} mode={mode} onHistoryOpen={onHistoryOpen} />
        )}
        {!onHistoryOpen && <div className="flex-1" />}

        <HeaderActions
          providerSettings={providerSettings}
          isSettingsOpen={isSettingsOpen}
          onSettingsToggle={onSettingsToggle}
          messageCount={messageCount}
          isStreaming={isStreaming}
          onCompact={onCompact}
          onClear={onClear}
        />
      </div>

      {usage && <UsageBar usage={usage} />}
    </div>
  );
};

export default AiChatHeader;
