import Markdown from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import LiveAvatar from './components/LiveAvatar';
import LiveHeader from './components/LiveHeader';
import LiveThinking from './components/LiveThinking';
import MessageTools from '../../../MessageTools';

import type { AiToolCall } from '@pmodules/AI/types';

export type LiveEntryProps = {
  isStreaming?: boolean;
  streamingText?: string;
  liveThinking?: string;
  liveTools?: AiToolCall[];
};

const LiveEntry = ({ isStreaming, streamingText, liveThinking, liveTools = [] }: LiveEntryProps) => {
  const { currentMode } = useAiChatContext();

  return (
    <div className="flex gap-2.5">
      <LiveAvatar mode={currentMode} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <LiveHeader
          mode={currentMode}
          isStreaming={isStreaming}
          liveThinking={liveThinking}
          streamingText={streamingText}
          liveTools={liveTools}
        />
        {liveThinking && <LiveThinking liveThinking={liveThinking} mode={currentMode} />}
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
    </div>
  );
};

export default LiveEntry;
