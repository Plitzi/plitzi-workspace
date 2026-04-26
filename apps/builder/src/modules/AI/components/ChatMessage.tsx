import Markdown from '@plitzi/plitzi-ui/Markdown';

import type { AiMessage } from '../types';

export type ChatMessageProps = Pick<AiMessage, 'role' | 'content'>;

const ChatMessage = ({ role, content }: ChatMessageProps) => (
  <div className={`flex flex-col gap-1 ${role === 'user' ? 'items-end' : 'items-start'}`}>
    <span className="text-xs font-medium text-gray-400">{role === 'user' ? 'You' : 'Assistant'}</span>
    <div
      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
        role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
      }`}
    >
      <Markdown>{content}</Markdown>
    </div>
  </div>
);

export default ChatMessage;
