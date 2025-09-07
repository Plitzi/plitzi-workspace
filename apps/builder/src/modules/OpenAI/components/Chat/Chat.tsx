import { useMemo } from 'react';

import ChatMessage from './ChatMessage';

import type { OpenAIMessage } from '@pmodules/OpenAI/types/openAI';
import type { RefObject } from 'react';

export type ChatProps = {
  ref?: RefObject<HTMLDivElement | null>;
  messages?: OpenAIMessage[];
};

const Chat = ({ ref, messages }: ChatProps) => {
  const messagesParsed = useMemo(() => messages?.filter(Boolean) ?? [], [messages]);

  return (
    <div className="m-3 flex min-h-0 grow basis-0" ref={ref}>
      <div className="flex w-full flex-col gap-4 overflow-y-auto">
        {messagesParsed.map(message => (
          <ChatMessage key={message.id} id={message.id} role={message.role} content={message.content} />
        ))}
      </div>
    </div>
  );
};

export default Chat;
