import ConversationButton from './components/ConversationButton';
import HeaderActions from './components/HeaderActions';
import UsageBar from './components/UsageBar';

import type { AiMode, AiUsage } from '../../types';

export type AiChatHeaderProps = {
  onClear: () => void;
  onCompact?: () => void;
  isStreaming: boolean;
  messageCount?: number;
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
  usage,
  isSettingsOpen,
  onSettingsToggle,
  onHistoryOpen,
  mode,
  conversationTitle
}: AiChatHeaderProps) => {
  return (
    <div className="shrink-0 border-b border-neutral-200 bg-neutral-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {onHistoryOpen && (
          <ConversationButton conversationTitle={conversationTitle} mode={mode} onHistoryOpen={onHistoryOpen} />
        )}
        {!onHistoryOpen && <div className="flex-1" />}

        <HeaderActions
          isSettingsOpen={isSettingsOpen}
          onSettingsToggle={onSettingsToggle}
          isStreaming={isStreaming}
          onClear={onClear}
        />
      </div>

      {usage && <UsageBar usage={usage} onCompact={onCompact} isStreaming={isStreaming} messageCount={messageCount} />}
    </div>
  );
};

export default AiChatHeader;
