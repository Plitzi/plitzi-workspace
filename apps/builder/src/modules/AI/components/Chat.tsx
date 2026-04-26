import Markdown from '@plitzi/plitzi-ui/Markdown';

import ChatMessage from './ChatMessage';
import ToolCallGroup from './ToolCallGroup';

import type { AiMessage, AiToolCall } from '../types';
import type { RefObject } from 'react';

export type ChatProps = {
  ref?: RefObject<HTMLDivElement | null>;
  messages: AiMessage[];
  streamingText?: string;
  liveThinking?: string;
  liveTools?: AiToolCall[];
};

const TimelineDot = ({ role, pulse = false }: { role: 'user' | 'assistant'; pulse?: boolean }) => (
  <div
    className={`relative z-10 mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 bg-white dark:bg-zinc-950 ${
      pulse ? 'animate-pulse' : ''
    } ${role === 'user' ? 'border-emerald-400 dark:border-emerald-500' : 'border-violet-400 dark:border-violet-500'}`}
  />
);

const Chat = ({ ref, messages = [], streamingText, liveThinking, liveTools = [] }: ChatProps) => {
  const hasLive = liveThinking || liveTools.length > 0 || streamingText;

  return (
    <div ref={ref} className="flex min-h-0 grow basis-0 flex-col overflow-y-auto px-4 py-3">
      {/* Empty state */}
      {messages.length === 0 && !hasLive && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="text-3xl text-violet-500 dark:text-violet-400">◆</span>
          <p className="font-mono text-sm text-zinc-400 dark:text-zinc-500">Ask me anything about your space.</p>
          <p className="font-mono text-xs text-zinc-300 dark:text-zinc-700">Voice · Images · Tools</p>
        </div>
      )}

      {/* Timeline */}
      {(messages.length > 0 || hasLive) && (
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute top-3 bottom-3 left-1.25 w-px bg-gray-200 dark:bg-zinc-800" />

          {/* Past messages */}
          {messages.map(msg => (
            <div key={msg.id} className="relative flex gap-3 pb-4">
              <TimelineDot role={msg.role} />
              <div className="min-w-0 flex-1">
                <ChatMessage {...msg} />
              </div>
            </div>
          ))}

          {/* Live streaming entry */}
          {hasLive && (
            <div className="relative flex gap-3">
              <TimelineDot role="assistant" pulse />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-mono text-xs font-semibold text-violet-500 dark:text-violet-400">
                  ◆ Assistant
                </span>

                {/* Thinking live */}
                {liveThinking && (
                  <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400 italic dark:text-zinc-500">
                    <span>💭</span>
                    <span className="truncate">{liveThinking}</span>
                    <span className="inline-block h-3 w-0.5 animate-pulse bg-zinc-400 align-middle dark:bg-zinc-500" />
                  </div>
                )}

                {/* Tools live (expanded by default while streaming) */}
                {liveTools.length > 0 && <ToolCallGroup tools={liveTools} defaultOpen />}

                {/* Streaming text */}
                {streamingText && (
                  <div className="pl-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-100">
                    <Markdown>{streamingText}</Markdown>
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-500 align-middle dark:bg-violet-400" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;
