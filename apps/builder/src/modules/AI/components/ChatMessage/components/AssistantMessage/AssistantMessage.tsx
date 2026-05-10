import Markdown from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';
import { useMemo } from 'react';

import ModeLabel from '@pmodules/AI/components/ModeLabel';

import MessageTools from '../../../MessageTools';
import getBrandResult from '../../helpers/getBrandResult';
import getColorPaletteResult from '../../helpers/getColorPaletteResult';
import getStagePreviewResult from '../../helpers/getStagePreviewResult';
import getStyleGuideResult from '../../helpers/getStyleGuideResult';
import getWireframeResult from '../../helpers/getWireframeResult';
import { formatTime } from '../../helpers/utils';
import ActionButtons from '../ActionButtons';
import AIBrandPreview from '../AIBrandPreview';
import AIColorPalettePreview from '../AIColorPalettePreview';
import AIStyleGuidePreview from '../AIStyleGuidePreview';
import AITemplatePreview from '../AITemplatePreview';
import AIWireframePreview from '../AIWireframePreview';
import ThinkingBlock from '../ThinkingBlock';

import type { AiMessage, AiMode, AiToolCall } from '../../../../types';

export type AssistantMessageProps = {
  id: AiMessage['id'];
  content?: string;
  thinking?: string;
  thinkingDurationMs?: number;
  irrelevant?: boolean;
  mode?: AiMode;
  usage?: AiMessage['usage'];
  actions?: AiMessage['actions'];
  tools?: AiToolCall[];
  createdAt?: number;
  stagePreviewVersion?: number;
  wireframeVersion?: number;
};

const AssistantMessage = ({
  id,
  content,
  thinking,
  thinkingDurationMs,
  irrelevant,
  mode = 'build',
  usage,
  actions,
  tools,
  createdAt,
  stagePreviewVersion,
  wireframeVersion
}: AssistantMessageProps) => {
  const preview = useMemo(() => getStagePreviewResult(tools), [tools]);
  const wireframe = useMemo(() => getWireframeResult(tools), [tools]);
  const colorPalette = useMemo(() => getColorPaletteResult(tools), [tools]);
  const brand = useMemo(() => getBrandResult(tools), [tools]);
  const styleGuide = useMemo(() => getStyleGuideResult(tools), [tools]);

  return (
    <div className="flex flex-col gap-1.5" data-id={id}>
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
        <span
          className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', {
            'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)] dark:bg-emerald-400': mode === 'build',
            'bg-sky-500 shadow-[0_0_5px_rgba(14,165,233,0.7)] dark:bg-sky-400': mode === 'plan'
          })}
        />
        <span className="font-medium text-zinc-900 dark:text-zinc-100">Plitzi</span>
        <span>{formatTime(createdAt)}</span>
        <ModeLabel mode={mode} />
        {irrelevant && (
          <span className="flex items-center gap-1 rounded-md border border-yellow-500/50 bg-yellow-50 px-2 py-0.5 text-yellow-600 dark:border-yellow-400/30 dark:bg-yellow-900/20 dark:text-yellow-400">
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92A5.5 5.5 0 0014.5 17h-9a5.5 5.5 0 00-4.743 6.98l-5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-[10px] font-medium">off-topic</span>
          </span>
        )}
        {usage && (
          <span className="text-zinc-400 dark:text-zinc-600">
            {usage.inputTokens.toLocaleString()} in · {usage.outputTokens.toLocaleString()} out
            {usage.thinkingTokens ? ` · ${usage.thinkingTokens.toLocaleString()} thinking` : ''}
          </span>
        )}
      </div>

      {thinking && <ThinkingBlock text={thinking} durationMs={thinkingDurationMs} />}
      {tools && tools.length > 0 && <MessageTools tools={tools} />}
      {content && (
        <div className="text-[13px] leading-[1.6] text-zinc-900 dark:text-zinc-100">
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

export default AssistantMessage;
