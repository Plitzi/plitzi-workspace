import Markdown from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';
import { Fragment, useMemo } from 'react';

import ModeLabel from '@pmodules/AI/components/ModeLabel';

import CopyButton from '../../../CopyButton';
import MessageTools from '../../../MessageTools';
import ToolVisualRenderer from '../../../ToolVisualRenderer';
import groupStepsIntoItems from '../../helpers/groupStepsIntoItems';
import { formatTime } from '../../helpers/utils';
import ActionButtons from '../ActionButtons';
import ResourceStep from '../ResourceStep';
import ThinkingBlock from '../ThinkingBlock';

import type { AiMessage, AiMessageStep, AiMode } from '../../../../types';

export type AssistantMessageProps = {
  id: AiMessage['id'];
  content?: string;
  irrelevant?: boolean;
  mode?: AiMode;
  usage?: AiMessage['usage'];
  actions?: AiMessage['actions'];
  steps?: AiMessageStep[];
  createdAt?: number;
  previewConceptVersion?: number;
  wireframeVersion?: number;
};

const AssistantMessage = ({
  id,
  content,
  irrelevant,
  mode = 'build',
  usage,
  actions,
  steps,
  createdAt,
  previewConceptVersion,
  wireframeVersion
}: AssistantMessageProps) => {
  const groupedSteps = useMemo(() => (steps ? groupStepsIntoItems(steps) : null), [steps]);

  return (
    <div className="group flex flex-col gap-1.5" data-id={id}>
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

      {groupedSteps &&
        groupedSteps.map(item => {
          if (item.type === 'thinking') {
            return <ThinkingBlock key={item.key} text={item.step.text} durationMs={item.step.durationMs} />;
          }

          if (item.type === 'resource') {
            return <ResourceStep key={item.key} name={item.step.name} uri={item.step.uri} />;
          }

          if (item.type === 'tools') {
            return (
              <Fragment key={item.key}>
                <MessageTools tools={item.tools} />
                {item.visual && (
                  <ToolVisualRenderer
                    visual={item.visual}
                    mode={mode}
                    previewConceptVersion={previewConceptVersion}
                    wireframeVersion={wireframeVersion}
                  />
                )}
              </Fragment>
            );
          }

          return (
            <div key={item.key} className="text-[13px] leading-[1.6] text-zinc-900 dark:text-zinc-100">
              <Markdown>{item.step.text}</Markdown>
            </div>
          );
        })}

      {!steps?.length && content && (
        <div className="text-[13px] leading-[1.6] text-zinc-900 dark:text-zinc-100">
          <Markdown>{content}</Markdown>
        </div>
      )}

      {actions && actions.length > 0 && <ActionButtons actions={actions} />}

      {!irrelevant && content && (
        <div className="pl-1 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton text={content} title="Copy response" className="font-mono text-[10px]" />
        </div>
      )}
    </div>
  );
};

export default AssistantMessage;
