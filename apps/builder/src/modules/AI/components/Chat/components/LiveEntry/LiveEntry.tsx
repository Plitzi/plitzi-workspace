import Markdown from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';
import { Fragment, useMemo } from 'react';

import ResourceStep from '@pmodules/AI/components/ChatMessage/components/ResourceStep';
import ThinkingBlock from '@pmodules/AI/components/ChatMessage/components/ThinkingBlock';
import groupStepsIntoItems from '@pmodules/AI/components/ChatMessage/helpers/groupStepsIntoItems';
import ToolVisualRenderer from '@pmodules/AI/components/ToolVisualRenderer';
import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import LiveHeader from './components/LiveHeader';
import LiveThinking from './components/LiveThinking';
import MessageTools from '../../../MessageTools';

import type { AiLiveStep } from '@pmodules/AI/types';

export type LiveEntryProps = {
  isStreaming?: boolean;
  isBusy?: boolean;
  streamingText?: string;
  liveSteps?: AiLiveStep[];
};

const LiveEntry = ({ isStreaming, isBusy, streamingText, liveSteps = [] }: LiveEntryProps) => {
  const { currentMode } = useAiChatContext();

  const groupedSteps = useMemo(() => groupStepsIntoItems(liveSteps), [liveSteps]);

  return (
    <div className="flex flex-col gap-1.5">
      <LiveHeader
        mode={currentMode}
        isStreaming={isStreaming}
        isBusy={isBusy}
        liveSteps={liveSteps}
        streamingText={streamingText}
      />
      {groupedSteps.map(item => {
        let content = null;
        if (item.type === 'thinking' && item.step.done) {
          content = <ThinkingBlock text={item.step.text} durationMs={item.step.durationMs} />;
        } else if (item.type === 'thinking') {
          content = <LiveThinking liveThinking={item.step.text} mode={currentMode} />;
        } else if (item.type === 'resource') {
          content = <ResourceStep name={item.step.name} uri={item.step.uri} />;
        } else if (item.type === 'tools') {
          content = (
            <Fragment>
              <MessageTools tools={item.tools} defaultOpen={item.tools.some(t => t.status === 'running')} />
              {item.visual && <ToolVisualRenderer visual={item.visual} mode={currentMode} />}
            </Fragment>
          );
        } else {
          content = (
            <div className="text-[13px] leading-[1.6] text-zinc-900 dark:text-zinc-100">
              <Markdown>{item.step.text}</Markdown>
            </div>
          );
        }

        return (
          <div key={item.key} className="animate-fade-in-up">
            {content}
          </div>
        );
      })}
      {streamingText && (
        <div className="animate-fade-in text-[13px] leading-[1.6] text-zinc-900 dark:text-zinc-100">
          <Markdown>{streamingText}</Markdown>
          <span
            className={clsx('animate-blink ml-0.5 inline-block h-4 w-0.5 align-middle', {
              'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
              'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
            })}
          />
        </div>
      )}
    </div>
  );
};

export default LiveEntry;
