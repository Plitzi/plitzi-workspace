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

type ChatMessageProps = AiMessage & {
  stagePreviewVersion?: number;
  wireframeVersion?: number;
};

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
  createdAt,
  stagePreviewVersion,
  wireframeVersion
}: ChatMessageProps) => {
  const isUser = role === 'user';
  const preview = useMemo(() => getStagePreviewResult(tools), [tools]);
  const wireframe = useMemo(() => getWireframeResult(tools), [tools]);
  const colorPalette = useMemo(() => getColorPaletteResult(tools), [tools]);
  const brand = useMemo(() => getBrandResult(tools), [tools]);
  const styleGuide = useMemo(() => getStyleGuideResult(tools), [tools]);

  if (isUser) {
    return (
      <div className="flex justify-end" data-id={id}>
        <div className="max-w-[88%]">
          {attachments && attachments.length > 0 && (
            <div className="mb-1.5 flex flex-wrap justify-end gap-2">
              {attachments.map(a => (
                <img
                  key={a.id}
                  src={`data:${a.mimeType};base64,${a.data}`}
                  alt={a.name}
                  className="h-20 w-20 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                />
              ))}
            </div>
          )}
          <div className="rounded-2xl rounded-tr-sm bg-zinc-100 px-3.5 py-2.5 dark:bg-zinc-800/80">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">
              {content}
            </p>
          </div>
          <div className="mt-1 pr-0.5 text-right font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
            {formatTime(createdAt)}
            {irrelevant && <span className="ml-1.5 text-amber-500">· off-topic</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" data-id={id}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-orange-500 dark:text-orange-400">◆ AI</span>
        <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{formatTime(createdAt)}</span>
        {mode === 'plan' && (
          <span className="rounded bg-sky-100 px-1 py-px font-mono text-[9px] text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
            plan
          </span>
        )}
        {irrelevant && <span className="font-mono text-[10px] text-amber-500">off-topic</span>}
        {usage && (
          <span className="font-mono text-[10px] text-zinc-300 dark:text-zinc-700">
            {usage.inputTokens.toLocaleString()} in · {usage.outputTokens.toLocaleString()} out
            {usage.thinkingTokens ? ` · ${usage.thinkingTokens.toLocaleString()} thinking` : ''}
          </span>
        )}
      </div>

      {thinking && <ThinkingBlock text={thinking} durationMs={thinkingDurationMs} />}

      {tools && tools.length > 0 && <MessageTools tools={tools} />}

      {content && (
        <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-100">
          <Markdown>{content}</Markdown>
        </div>
      )}

      {styleGuide && <AIStyleGuidePreview {...styleGuide} mode={mode} />}
      {brand && <AIBrandPreview {...brand} mode={mode} />}
      {colorPalette && <AIColorPalettePreview {...colorPalette} mode={mode} />}
      {wireframe && <AIWireframePreview {...wireframe} mode={mode} version={wireframeVersion} />}
      {preview && (
        <AITemplatePreview
          baseElementId={preview.baseElementId}
          schema={preview.schema}
          style={preview.style}
          html={preview.html}
          mode={mode}
          version={stagePreviewVersion}
        />
      )}

      {actions && actions.length > 0 && <ActionButtons actions={actions} />}
    </div>
  );
};

const MemoizedChatMessage = memo(ChatMessage);
export default MemoizedChatMessage;
