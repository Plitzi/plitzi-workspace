import Markdown from '@plitzi/plitzi-ui/Markdown';

import ActionButtons from './ActionButtons';
import AiTemplatePreview from './AiTemplatePreview';
import SdkElementPreview from './SdkElementPreview';
import ThinkingBlock from './ThinkingBlock';
import ToolCallGroup from '../ToolCallGroup';

import type { AiMessage } from '../../types';

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatMessage = ({ role, content, thinking, preview, actions, attachments, tools, createdAt }: AiMessage) => {
  const isUser = role === 'user';

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        {isUser ? (
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">▸ You</span>
        ) : (
          <span className="font-mono text-xs font-semibold text-violet-500 dark:text-violet-400">◆ Assistant</span>
        )}
        <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">{formatTime(createdAt)}</span>
      </div>

      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-2">
          {attachments.map(a => (
            <img
              key={a.id}
              src={`data:${a.mimeType};base64,${a.data}`}
              alt={a.name}
              className="h-24 w-24 rounded-md border border-gray-300 object-cover dark:border-zinc-700"
            />
          ))}
        </div>
      )}

      {thinking && <ThinkingBlock text={thinking} />}

      {tools && tools.length > 0 && <ToolCallGroup tools={tools} />}

      {content && (
        <div
          className={`pl-2 text-sm leading-relaxed ${isUser ? 'text-zinc-600 dark:text-zinc-200' : 'text-zinc-700 dark:text-zinc-100'}`}
        >
          {isUser ? <span className="whitespace-pre-wrap">{content}</span> : <Markdown>{content}</Markdown>}
        </div>
      )}

      {preview?.elementId && (
        <div className="mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700">
          <div className="border-b border-gray-100 bg-gray-50 px-3 py-1 font-mono text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
            preview · {preview.elementId}
          </div>
          <SdkElementPreview elementId={preview.elementId} />
        </div>
      )}

      {preview?.baseElementId && (
        <div className="mt-2 overflow-hidden rounded-md border border-violet-200 dark:border-violet-900/50">
          <div className="flex items-center gap-2 border-b border-violet-100 bg-violet-50 px-3 py-1 font-mono text-xs text-violet-500 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-400">
            <span>◈</span>
            <span>proposed · {preview.baseElementId}</span>
          </div>
          <AiTemplatePreview baseElementId={preview.baseElementId} schema={preview.schema} style={preview.style} />
        </div>
      )}

      {actions && actions.length > 0 && <ActionButtons actions={actions} />}
    </div>
  );
};

export default ChatMessage;
