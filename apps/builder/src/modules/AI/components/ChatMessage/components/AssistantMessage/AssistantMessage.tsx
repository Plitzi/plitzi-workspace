import Markdown from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';
import { useMemo } from 'react';

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

type AssistantMessageProps = {
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
    <div className="flex gap-2.5" data-id={id}>
      <div
        className={clsx(
          'mt-0.5 grid h-5.5 w-5.5 shrink-0 place-items-center rounded-[5px] border bg-neutral-50 font-mono text-[9px] font-bold dark:bg-zinc-800',
          {
            'border-emerald-500/50 text-emerald-500 dark:border-emerald-400/50 dark:text-emerald-400': mode === 'build',
            'border-sky-500/50 text-sky-500 dark:border-sky-400/50 dark:text-sky-400': mode === 'plan'
          }
        )}
      >
        P
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Plitzi</span>
          <span>{formatTime(createdAt)}</span>
          <span
            className={clsx('rounded border px-1.5 py-px font-mono text-[8px] tracking-wider uppercase', {
              'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-400':
                mode === 'build',
              'border-sky-500/50 bg-sky-500/10 text-sky-500 dark:border-sky-400/50 dark:bg-sky-400/10 dark:text-sky-400':
                mode === 'plan'
            })}
          >
            {mode}
          </span>
          {irrelevant && <span className="text-yellow-500 dark:text-yellow-400">off-topic</span>}
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
    </div>
  );
};

export default AssistantMessage;
