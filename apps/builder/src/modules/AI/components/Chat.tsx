import Markdown from '@plitzi/plitzi-ui/Markdown';

import ChatMessage from './ChatMessage';
import ToolCall from './ToolCall';

import type { AiMessage, AiToolCall } from '../types';
import type { RefObject } from 'react';

export type ChatProps = {
  ref?: RefObject<HTMLDivElement | null>;
  messages: AiMessage[];
  streamingText?: string;
  liveTools?: AiToolCall[];
};

const Chat = ({ ref, messages = [], streamingText, liveTools = [] }: ChatProps) => (
  <div ref={ref} className="flex min-h-0 grow basis-0 flex-col overflow-y-auto px-4 py-2">
    {messages.length === 0 && !streamingText && (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <span className="text-3xl text-violet-400">◆</span>
        <p className="font-mono text-sm text-zinc-500">Ask me anything about your space.</p>
        <p className="font-mono text-xs text-zinc-700">Voice · Images · Tools</p>
      </div>
    )}

    {messages.map((msg, i) => (
      <div key={msg.id}>
        <ChatMessage {...msg} />
        {i < messages.length - 1 && <div className="border-b border-zinc-800" />}
      </div>
    ))}

    {/* Active streaming entry */}
    {(liveTools.length > 0 || streamingText) && (
      <div className="flex flex-col gap-1 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-violet-400">◆ Assistant</span>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
        </div>

        {liveTools.length > 0 && (
          <div className="flex flex-col gap-0.5 border-l-2 border-zinc-800 py-1">
            {liveTools.map(t => (
              <ToolCall key={t.id} {...t} />
            ))}
          </div>
        )}

        {streamingText && (
          <div className="pl-4 text-sm leading-relaxed text-zinc-100">
            <Markdown>{streamingText}</Markdown>
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-400 align-middle" />
          </div>
        )}
      </div>
    )}
  </div>
);

export default Chat;
