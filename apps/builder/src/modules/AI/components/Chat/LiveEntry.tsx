import Markdown from '@plitzi/plitzi-ui/Markdown';
import { useEffect, useRef } from 'react';

import ToolCallGroup from '../ToolCallGroup';
import TimelineDot from './TimelineDot';

import type { AiToolCall } from '../../types';

type LiveEntryProps = {
  isStreaming?: boolean;
  streamingText?: string;
  liveThinking?: string;
  liveTools?: AiToolCall[];
};

const LiveEntry = ({ isStreaming, streamingText, liveThinking, liveTools = [] }: LiveEntryProps) => {
  const thinkingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [liveThinking]);

  return (
    <div className="relative flex gap-3">
      <TimelineDot role="assistant" pulse />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-mono text-xs font-semibold text-violet-500 dark:text-violet-400">◆ Assistant</span>

        {isStreaming && !liveThinking && !streamingText && liveTools.length === 0 && (
          <div className="flex items-center gap-1 pl-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.3s] dark:bg-zinc-600" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.15s] dark:bg-zinc-600" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 dark:bg-zinc-600" />
          </div>
        )}

        {liveThinking && (
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 font-mono text-xs leading-4 text-zinc-400 italic dark:text-zinc-500">💭</span>
            <div
              ref={thinkingRef}
              className="max-h-100 min-w-0 flex-1 overflow-y-auto font-mono text-xs leading-relaxed text-zinc-400 italic dark:text-zinc-500"
            >
              <span className="wrap-break-word whitespace-pre-wrap">{liveThinking}</span>
              <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-zinc-400 align-middle dark:bg-zinc-500" />
            </div>
          </div>
        )}

        {liveTools.length > 0 && <ToolCallGroup tools={liveTools} defaultOpen />}

        {streamingText && (
          <div className="pl-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-100">
            <Markdown>{streamingText}</Markdown>
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-500 align-middle dark:bg-violet-400" />
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveEntry;
