import Markdown from '@plitzi/plitzi-ui/Markdown';
import { useEffect, useRef, useState } from 'react';

import MessageTools from '../MessageTools';
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
  const [thinkingOpen, setThinkingOpen] = useState(true);

  useEffect(() => {
    if (thinkingOpen && thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [liveThinking, thinkingOpen]);

  return (
    <div className="relative flex gap-3">
      <TimelineDot role="assistant" pulse />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-mono text-xs font-semibold text-orange-500 dark:text-orange-400">◆ Assistant</span>

        {isStreaming && !liveThinking && !streamingText && liveTools.length === 0 && (
          <div className="flex items-center gap-1 pl-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.3s] dark:bg-zinc-600" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.15s] dark:bg-zinc-600" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 dark:bg-zinc-600" />
          </div>
        )}

        {liveThinking && (
          <div className="mb-0.5">
            <button
              onClick={() => setThinkingOpen(o => !o)}
              className="flex items-center gap-1 rounded px-1.5 py-px font-mono text-xs text-zinc-400 transition-colors hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-800/60"
            >
              <span>💭</span>
              <span>Thinking...</span>
              <span className="ml-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400 dark:bg-orange-500" />
              <span className="text-zinc-300 dark:text-zinc-600">{thinkingOpen ? '▲' : '▼'}</span>
            </button>
            {thinkingOpen && (
              <div
                ref={thinkingRef}
                className="mt-0.5 ml-2 max-h-40 overflow-y-auto border-l-2 border-zinc-200 pl-3 font-mono text-xs leading-snug text-zinc-400 italic dark:border-zinc-700 dark:text-zinc-500"
              >
                <span className="wrap-break-word whitespace-pre-wrap">{liveThinking}</span>
                <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-zinc-400 align-middle dark:bg-zinc-500" />
              </div>
            )}
          </div>
        )}

        {liveTools.length > 0 && <MessageTools tools={liveTools} defaultOpen />}

        {streamingText && (
          <div className="pl-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-100">
            <Markdown>{streamingText}</Markdown>
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-orange-500 align-middle dark:bg-orange-400" />
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveEntry;
