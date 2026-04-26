import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import Markdown from '@plitzi/plitzi-ui/Markdown';
import { useState } from 'react';

import { createStoreHook } from '@plitzi/sdk-shared/store';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import ToolCallGroup from './ToolCallGroup';

import type { AiMessage, AiMessagePreview } from '../types';
import type { BuilderState } from '@plitzi/sdk-shared';

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ThinkingBlock = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-1">
      <button
        className="flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs text-zinc-400 transition-colors hover:bg-gray-100 dark:text-zinc-500 dark:hover:bg-zinc-800/60"
        onClick={() => setOpen(o => !o)}
      >
        <span>💭</span>
        <span>Thought for a moment</span>
        <span className="text-zinc-300 dark:text-zinc-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-0.5 ml-2 border-l-2 border-gray-200 pl-3 font-mono text-xs leading-relaxed text-zinc-400 italic dark:border-zinc-700 dark:text-zinc-500">
          {text}
        </div>
      )}
    </div>
  );
};

const ElementPreview = ({ elementId }: AiMessagePreview) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [element] = useStore(`schema.flat.${elementId}`);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!element) {
    return (
      <div className="flex h-20 items-center justify-center font-mono text-xs text-zinc-400 dark:text-zinc-600">
        element not found · {elementId}
      </div>
    );
  }

  return (
    <ContainerAutoScale className="flex min-h-40 w-full items-center justify-center overflow-hidden bg-white dark:bg-zinc-950">
      <BuilderAreaPreview id={elementId} className="h-full w-full" previewMode />
    </ContainerAutoScale>
  );
};

const ChatMessage = ({ role, content, thinking, preview, attachments, tools, createdAt }: AiMessage) => {
  const isUser = role === 'user';

  return (
    <div className="flex flex-col gap-0.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        {isUser ? (
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">▸ You</span>
        ) : (
          <span className="font-mono text-xs font-semibold text-violet-500 dark:text-violet-400">◆ Assistant</span>
        )}
        <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">{formatTime(createdAt)}</span>
      </div>

      {/* Image attachments */}
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

      {/* Thinking block */}
      {thinking && <ThinkingBlock text={thinking} />}

      {/* Tool calls */}
      {tools && tools.length > 0 && <ToolCallGroup tools={tools} />}

      {/* Message text — Markdown dark mode handled via .dark .markdown CSS in plitzi-ui */}
      {content && (
        <div
          className={`pl-2 text-sm leading-relaxed ${isUser ? 'text-zinc-600 dark:text-zinc-200' : 'text-zinc-700 dark:text-zinc-100'}`}
        >
          {isUser ? <span className="whitespace-pre-wrap">{content}</span> : <Markdown>{content}</Markdown>}
        </div>
      )}

      {/* SDK element preview */}
      {preview && (
        <div className="mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700">
          <div className="border-b border-gray-100 bg-gray-50 px-3 py-1 font-mono text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
            preview · {preview.elementId}
          </div>
          <ElementPreview elementId={preview.elementId} />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
