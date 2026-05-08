import Markdown from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

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
  const thinkingRef = useRef<HTMLDivElement>(null);
  const [thinkingOpen, setThinkingOpen] = useState(true);

  useEffect(() => {
    if (thinkingOpen && thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [liveThinking, thinkingOpen]);

  return (
    <div className="flex gap-2.5">
      <div
        className={clsx(
          'mt-0.5 grid h-5.5 w-5.5 shrink-0 place-items-center rounded-[5px] border bg-neutral-50 font-mono text-[9px] font-bold dark:bg-zinc-800',
          {
            'border-emerald-500/50 text-emerald-500 dark:border-emerald-400/50 dark:text-emerald-400':
              currentMode === 'build',
            'border-sky-500/50 text-sky-500 dark:border-sky-400/50 dark:text-sky-400': currentMode === 'plan'
          }
        )}
      >
        P
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Plitzi</span>
          {isStreaming && !liveThinking && !streamingText && liveTools.length === 0 && (
            <div className="ml-1 flex items-center gap-1">
              <span
                className={clsx('h-1 w-1 animate-bounce rounded-full [animation-delay:-0.3s]', {
                  'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
                  'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
                })}
              />
              <span
                className={clsx('h-1 w-1 animate-bounce rounded-full [animation-delay:-0.15s]', {
                  'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
                  'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
                })}
              />
              <span
                className={clsx('h-1 w-1 animate-bounce rounded-full', {
                  'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
                  'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
                })}
              />
            </div>
          )}
        </div>

        {liveThinking && (
          <div className="mb-0.5">
            <button
              onClick={() => setThinkingOpen(o => !o)}
              className="flex items-center gap-1.5 rounded px-1.5 py-px font-mono text-[10px] text-zinc-500 transition-colors hover:bg-neutral-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <span className="text-sky-500 dark:text-sky-400">◈</span>
              <span>Thinking…</span>
              <span
                className={clsx('inline-block h-1.5 w-1.5 animate-pulse rounded-full', {
                  'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
                  'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
                })}
              />
              <span className="text-zinc-400 dark:text-zinc-600">{thinkingOpen ? '▲' : '▼'}</span>
            </button>
            {thinkingOpen && (
              <div
                ref={thinkingRef}
                className="mt-0.5 ml-2 max-h-40 overflow-y-auto border-l-2 border-neutral-300 pl-3 font-mono text-[10px] leading-snug text-zinc-400 italic dark:border-zinc-700 dark:text-zinc-600"
              >
                <span className="wrap-break-word whitespace-pre-wrap">{liveThinking}</span>
                <span
                  className={clsx('ml-0.5 inline-block h-3 w-0.5 animate-pulse align-middle', {
                    'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
                    'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
                  })}
                />
              </div>
            )}
          </div>
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
    </div>
  );
};

export default LiveEntry;
