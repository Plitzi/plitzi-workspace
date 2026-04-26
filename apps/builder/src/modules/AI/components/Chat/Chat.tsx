import ChatMessage from '../ChatMessage';
import LiveEntry from './LiveEntry';
import TimelineDot from './TimelineDot';

import type { AiMessage, AiToolCall } from '../../types';
import type { RefObject } from 'react';

export type ChatProps = {
  ref?: RefObject<HTMLDivElement | null>;
  messages: AiMessage[];
  streamingText?: string;
  liveThinking?: string;
  liveTools?: AiToolCall[];
};

const Chat = ({ ref, messages = [], streamingText, liveThinking, liveTools = [] }: ChatProps) => {
  const hasLive = liveThinking || liveTools.length > 0 || streamingText;

  return (
    <div ref={ref} className="flex min-h-0 grow basis-0 flex-col overflow-y-auto px-4 py-3">
      {messages.length === 0 && !hasLive && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="text-3xl text-violet-500 dark:text-violet-400">◆</span>
          <p className="font-mono text-sm text-zinc-400 dark:text-zinc-500">Ask me anything about your space.</p>
          <p className="font-mono text-xs text-zinc-300 dark:text-zinc-700">Voice · Images · Tools</p>
        </div>
      )}

      {(messages.length > 0 || hasLive) && (
        <div className="relative">
          <div className="absolute top-3 bottom-3 left-1.25 w-px bg-gray-200 dark:bg-zinc-800" />

          {messages.map(msg => (
            <div key={msg.id} className="relative flex gap-3 pb-4">
              <TimelineDot role={msg.role} />
              <div className="min-w-0 flex-1">
                <ChatMessage {...msg} />
              </div>
            </div>
          ))}

          {hasLive && (
            <LiveEntry streamingText={streamingText} liveThinking={liveThinking} liveTools={liveTools} />
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;
