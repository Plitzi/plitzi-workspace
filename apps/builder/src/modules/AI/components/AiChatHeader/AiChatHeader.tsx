import ConversationButton from './components/ConversationButton';
import HeaderActions from './components/HeaderActions';

import type { AiMode, ConversationSummary } from '../../types';

export type AiChatHeaderProps = {
  onClear: () => void;
  isStreaming: boolean;
  isSettingsOpen?: boolean;
  onSettingsToggle?: () => void;
  mode?: AiMode;
  conversationTitle?: string;
  conversations?: ConversationSummary[];
  currentConversationId?: string;
  onLoadConversations?: () => Promise<void>;
  onLoadConversation?: (id: string) => Promise<void>;
};

const AiChatHeader = ({
  onClear,
  isStreaming,
  isSettingsOpen,
  onSettingsToggle,
  mode,
  conversationTitle,
  conversations,
  currentConversationId,
  onLoadConversations,
  onLoadConversation
}: AiChatHeaderProps) => {
  return (
    <div className="shrink-0 border-b border-neutral-200 bg-neutral-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <ConversationButton
          conversationTitle={conversationTitle}
          mode={mode}
          conversations={conversations}
          currentConversationId={currentConversationId}
          onClear={onClear}
          onLoadConversations={onLoadConversations}
          onLoadConversation={onLoadConversation}
        />
        <HeaderActions
          isSettingsOpen={isSettingsOpen}
          onSettingsToggle={onSettingsToggle}
          isStreaming={isStreaming}
          onClear={onClear}
        />
      </div>
    </div>
  );
};

export default AiChatHeader;
