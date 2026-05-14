import Markdown from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';

import ThinkingBlock from '@pmodules/AI/components/ChatMessage/components/ThinkingBlock';
import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import LiveHeader from './components/LiveHeader';
import LiveThinking from './components/LiveThinking';
import MessageTools from '../../../MessageTools';

import type { AiToolCall } from '@pmodules/AI/types';

export type LiveEntryProps = {
  isStreaming?: boolean;
  isBusy?: boolean;
  streamingText?: string;
  liveThinking?: string;
  liveThinkingDoneMs?: number;
  liveTools?: AiToolCall[];
};

const LiveEntry = ({
  isStreaming,
  isBusy,
  streamingText,
  liveThinking,
  liveThinkingDoneMs,
  liveTools = []
}: LiveEntryProps) => {
  const { currentMode } = useAiChatContext();

  return (
    <div className="flex flex-col gap-1.5">
      <LiveHeader
        mode={currentMode}
        isStreaming={isStreaming}
        isBusy={isBusy}
        liveThinking={liveThinking}
        streamingText={streamingText}
        liveTools={liveTools}
      />
      {liveThinking && liveThinkingDoneMs !== undefined && (
        <ThinkingBlock text={liveThinking} durationMs={liveThinkingDoneMs} />
      )}
      {liveThinking && liveThinkingDoneMs === undefined && (
        <LiveThinking liveThinking={liveThinking} mode={currentMode} />
      )}
      {liveTools.length > 0 && <MessageTools tools={liveTools} defaultOpen />}
      {streamingText && (
        <div className="text-[13px] leading-[1.6] text-zinc-900 dark:text-zinc-100">
          <Markdown>{streamingText}</Markdown>
          <span
            className={clsx('ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle', {
              'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
              'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
            })}
          />
        </div>
      )}
    </div>
  );
};

export default LiveEntry;
