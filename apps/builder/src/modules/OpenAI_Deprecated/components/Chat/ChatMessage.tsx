import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import Message from './Message';

import type { OpenAIMessage, OpenAIRole } from '@pmodules/OpenAI_Deprecated/types/openAI';

export type ChatMessageProps = {
  id: string;
  role: OpenAIRole;
  content: OpenAIMessage['content'];
};

const ChatMessage = ({ id = '', role = 'assistant', content = [] }: ChatMessageProps) => {
  const roleLabel = role === 'assistant' ? 'Assistant' : 'You';

  const message = useMemo(
    () => content.map(item => ({ type: item.type, content: get(item, 'text.value', '') })),
    // .reduce((acum, item) => [...acum, item], [])
    [content]
  );

  // if run_id is null means that still pending to be processed, we should show an icon to indicate that

  return (
    <div className="flex flex-col text-sm" id={id}>
      <div className="flex gap-1 font-medium text-gray-900 dark:text-zinc-100">{roleLabel}</div>
      <Message message={message} />
    </div>
  );
};

export default ChatMessage;
