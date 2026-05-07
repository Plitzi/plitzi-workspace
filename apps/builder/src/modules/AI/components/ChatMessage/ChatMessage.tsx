import Markdown from '@plitzi/plitzi-ui/Markdown';
import { useMemo, memo } from 'react';

import MessageTools from '../MessageTools';
import ActionButtons from './components/ActionButtons';
import AIBrandPreview from './components/AIBrandPreview';
import AIColorPalettePreview from './components/AIColorPalettePreview';
import AIStyleGuidePreview from './components/AIStyleGuidePreview';
import AITemplatePreview from './components/AITemplatePreview';
import AIWireframePreview from './components/AIWireframePreview';
import ThinkingBlock from './components/ThinkingBlock';
import getBrandResult from './helpers/getBrandResult';
import getColorPaletteResult from './helpers/getColorPaletteResult';
import getStagePreviewResult from './helpers/getStagePreviewResult';
import getStyleGuideResult from './helpers/getStyleGuideResult';
import getWireframeResult from './helpers/getWireframeResult';
import { formatTime } from './helpers/utils';

import type { AiMessage } from '../../types';

const ChatMessage = ({
  id,
  role,
  content,
  thinking,
  thinkingDurationMs,
  irrelevant,
  mode,
  usage,
  actions,
  attachments,
  tools,
  createdAt
}: AiMessage) => {
  const isUser = role === 'user';
  const preview = useMemo(() => getStagePreviewResult(tools), [tools]);
  const wireframe = useMemo(() => getWireframeResult(tools), [tools]);
  const colorPalette = useMemo(() => getColorPaletteResult(tools), [tools]);
  const brand = useMemo(() => getBrandResult(tools), [tools]);
  const styleGuide = useMemo(() => getStyleGuideResult(tools), [tools]);

  return (
    <div className="flex flex-col gap-0.5" data-id={id}>
      <div className="flex items-center gap-2">
        {isUser ? (
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">▸ You</span>
        ) : (
          <span className="font-mono text-xs font-semibold text-violet-500 dark:text-violet-400">◆ Assistant</span>
        )}
        <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">{formatTime(createdAt)}</span>
        {irrelevant && <span className="font-mono text-xs text-amber-500 dark:text-amber-400">off-topic</span>}
        {!isUser && mode === 'plan' && <span className="font-mono text-xs text-blue-500 dark:text-blue-400">plan</span>}
        {!isUser && usage && (
          <span className="font-mono text-[10px] text-zinc-300 dark:text-zinc-700">
            {usage.inputTokens.toLocaleString()} in · {usage.outputTokens.toLocaleString()} out
            {usage.thinkingTokens ? ` · ${usage.thinkingTokens.toLocaleString()} thinking` : ''}
          </span>
        )}
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

      {thinking && <ThinkingBlock text={thinking} durationMs={thinkingDurationMs} />}

      {tools && tools.length > 0 && <MessageTools tools={tools} />}

      {content && (
        <div
          className={`pl-2 text-sm leading-relaxed ${isUser ? 'text-zinc-600 dark:text-zinc-200' : 'text-zinc-700 dark:text-zinc-100'}`}
        >
          {isUser ? <span className="whitespace-pre-wrap">{content}</span> : <Markdown>{content}</Markdown>}
        </div>
      )}

      {styleGuide && <AIStyleGuidePreview {...styleGuide} mode={mode} />}
      {brand && <AIBrandPreview {...brand} mode={mode} />}
      {colorPalette && <AIColorPalettePreview {...colorPalette} mode={mode} />}

      {wireframe && <AIWireframePreview {...wireframe} mode={mode} />}

      {preview && (
        <AITemplatePreview
          baseElementId={preview.baseElementId}
          schema={preview.schema}
          style={preview.style}
          html={preview.html}
          mode={mode}
        />
      )}

      {actions && actions.length > 0 && <ActionButtons actions={actions} />}
    </div>
  );
};

const MemoizedChatMessage = memo(ChatMessage);
export default MemoizedChatMessage;
