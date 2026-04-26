import Markdown from '@plitzi/plitzi-ui/Markdown';

import ToolCall from './ToolCall';

import type { AiMessage } from '../types';

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatMessage = ({ role, content, attachments, tools, createdAt }: AiMessage) => {
  const isUser = role === 'user';

  return (
    <div className="flex flex-col gap-1 py-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        {isUser ? (
          <span className="font-mono text-xs font-semibold text-emerald-400">▸ You</span>
        ) : (
          <span className="font-mono text-xs font-semibold text-violet-400">◆ Assistant</span>
        )}
        <span className="font-mono text-xs text-zinc-600">{formatTime(createdAt)}</span>
      </div>

      {/* Image attachments */}
      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-4">
          {attachments.map(a => (
            <img
              key={a.id}
              src={`data:${a.mimeType};base64,${a.data}`}
              alt={a.name}
              className="h-24 w-24 rounded-md border border-zinc-700 object-cover"
            />
          ))}
        </div>
      )}

      {/* Tool calls (assistant only) */}
      {tools && tools.length > 0 && (
        <div className="flex flex-col gap-0.5 border-l-2 border-zinc-800 py-1">
          {tools.map(t => (
            <ToolCall key={t.id} {...t} />
          ))}
        </div>
      )}

      {/* Message text */}
      {content && (
        <div className={`pl-4 text-sm leading-relaxed ${isUser ? 'text-zinc-200' : 'text-zinc-100'}`}>
          {isUser ? <span className="whitespace-pre-wrap">{content}</span> : <Markdown>{content}</Markdown>}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
