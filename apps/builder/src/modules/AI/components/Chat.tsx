import Markdown from '@plitzi/plitzi-ui/Markdown';

import ChatMessage from './ChatMessage';
import ToolActivity from './ToolActivity';

import type { AiMessage } from '../types';
import type { RefObject } from 'react';

export type ChatProps = {
  ref?: RefObject<HTMLDivElement | null>;
  messages: AiMessage[];
  streamingText?: string;
  activeTools?: string[];
};

const Chat = ({ ref, messages = [], streamingText, activeTools = [] }: ChatProps) => (
  <div className="m-3 flex min-h-0 grow basis-0" ref={ref}>
    <div className="flex w-full flex-col gap-4 overflow-y-auto">
      {messages.map(msg => (
        <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
      ))}
      {activeTools.length > 0 && <ToolActivity tools={activeTools} />}
      {streamingText && (
        <div className="flex flex-col items-start gap-1">
          <span className="text-xs font-medium text-gray-400">Assistant</span>
          <div className="max-w-[90%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
            <Markdown>{streamingText}</Markdown>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default Chat;
