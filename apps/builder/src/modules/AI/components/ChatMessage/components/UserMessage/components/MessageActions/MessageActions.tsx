import { useCallback } from 'react';

import { useAiChatContext } from '../../../../../../contexts/AiChatContext';
import CopyButton from '../../../../../CopyButton';

export type MessageActionsProps = {
  messageId: string;
  content: string;
};

const MessageActions = ({ messageId, content }: MessageActionsProps) => {
  const { isStreaming, forkFromMessage, newChatFromMessage } = useAiChatContext();

  const handleFork = useCallback(() => {
    void forkFromMessage(messageId, content);
  }, [forkFromMessage, messageId, content]);

  const handleNewChat = useCallback(() => {
    newChatFromMessage(content);
  }, [newChatFromMessage, content]);

  const buttonClass =
    'flex items-center gap-1 rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200';

  return (
    <div className="flex items-center gap-1 pl-1 font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
      <CopyButton text={content} title="Copy message" />

      <button
        type="button"
        className={buttonClass}
        onClick={handleFork}
        disabled={isStreaming}
        title="Fork from here (keep context)"
      >
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="4" cy="3.5" r="1.5" />
          <circle cx="4" cy="12.5" r="1.5" />
          <circle cx="12" cy="3.5" r="1.5" />
          <path d="M4 5v6M12 5v1.5a3 3 0 0 1-3 3H4" />
        </svg>
        <span>fork</span>
      </button>

      <button
        type="button"
        className={buttonClass}
        onClick={handleNewChat}
        disabled={isStreaming}
        title="New chat from this message"
      >
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v5A1.5 1.5 0 0 1 12.5 11H6l-3 2.5V11H3.5A1.5 1.5 0 0 1 2 9.5z" />
          <path d="M8 5.5v3M6.5 7h3" />
        </svg>
        <span>new</span>
      </button>
    </div>
  );
};

export default MessageActions;
