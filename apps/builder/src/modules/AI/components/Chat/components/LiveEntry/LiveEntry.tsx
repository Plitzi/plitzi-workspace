import Markdown from '@plitzi/plitzi-ui/Markdown';
import clsx from 'clsx';
import { Fragment, useMemo } from 'react';

import ResourceStep from '@pmodules/AI/components/ChatMessage/components/ResourceStep';
import ThinkingBlock from '@pmodules/AI/components/ChatMessage/components/ThinkingBlock';
import extractToolVisual, { VISUAL_TOOL_NAMES } from '@pmodules/AI/components/ChatMessage/helpers/extractToolVisual';
import ToolVisualRenderer from '@pmodules/AI/components/ToolVisualRenderer';
import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import LiveHeader from './components/LiveHeader';
import LiveThinking from './components/LiveThinking';
import MessageTools from '../../../MessageTools';

import type { ToolVisual } from '@pmodules/AI/components/ChatMessage/helpers/extractToolVisual';
import type { AiLiveStep, AiToolCall } from '@pmodules/AI/types';

export type LiveEntryProps = {
  isStreaming?: boolean;
  isBusy?: boolean;
  streamingText?: string;
  liveSteps?: AiLiveStep[];
};

type GroupedStep =
  | { type: 'thinking'; step: Extract<AiLiveStep, { type: 'thinking' }>; key: string }
  | { type: 'tools'; tools: AiToolCall[]; key: string; visual?: ToolVisual }
  | { type: 'resource'; step: Extract<AiLiveStep, { type: 'resource' }>; key: string }
  | { type: 'text'; step: Extract<AiLiveStep, { type: 'text' }>; key: string };

const LiveEntry = ({ isStreaming, isBusy, streamingText, liveSteps = [] }: LiveEntryProps) => {
  const { currentMode } = useAiChatContext();

  const groupedSteps = useMemo(() => {
    const items: GroupedStep[] = [];
    liveSteps.forEach((step, i) => {
      if (step.type === 'tool') {
        const toolCall: AiToolCall = {
          id: step.id,
          name: step.name,
          args: step.args,
          result: step.result,
          status: step.status
        };
        const isVisual = VISUAL_TOOL_NAMES.has(step.name);
        const last = items.at(-1);
        if (!isVisual && last?.type === 'tools' && !last.tools.some(t => VISUAL_TOOL_NAMES.has(t.name))) {
          last.tools = [...last.tools, toolCall];
        } else {
          items.push({ type: 'tools', tools: [toolCall], key: step.id });
        }
      } else if (step.type === 'thinking') {
        const last = items.at(-1);
        if (last?.type === 'thinking') {
          items[items.length - 1] = {
            ...last,
            step: {
              ...last.step,
              text: last.step.text + '\n\n' + step.text,
              durationMs: (last.step.durationMs ?? 0) + (step.durationMs ?? 0),
              done: step.done
            }
          };
        } else {
          items.push({ type: 'thinking', step, key: String(step.startMs) });
        }
      } else if (step.type === 'resource') {
        items.push({ type: 'resource', step, key: `res-${i}` });
      } else {
        items.push({ type: 'text', step, key: `tx-${i}` });
      }
    });

    const visuals = items.map(item => (item.type === 'tools' ? extractToolVisual(item.tools) : undefined));
    let lastVisualIdx = -1;
    visuals.forEach((v, i) => {
      if (v) {
        lastVisualIdx = i;
      }
    });

    return items.map((item, i) => {
      if (item.type !== 'tools' || i !== lastVisualIdx) {
        return item;
      }

      return { ...item, visual: visuals[i] };
    });
  }, [liveSteps]);

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
        if (item.type === 'thinking') {
          if (item.step.done) {
            return <ThinkingBlock key={item.key} text={item.step.text} durationMs={item.step.durationMs} />;
          }

          return <LiveThinking key={item.key} liveThinking={item.step.text} mode={currentMode} />;
        }

        if (item.type === 'resource') {
          return <ResourceStep key={item.key} name={item.step.name} uri={item.step.uri} />;
        }

        if (item.type === 'tools') {
          return (
            <Fragment key={item.key}>
              <MessageTools tools={item.tools} defaultOpen={item.tools.some(t => t.status === 'running')} />
              {item.visual && <ToolVisualRenderer visual={item.visual} mode={currentMode} />}
            </Fragment>
          );
        }

        return (
          <div key={item.key} className="text-[13px] leading-[1.6] text-zinc-900 dark:text-zinc-100">
            <Markdown>{item.step.text}</Markdown>
          </div>
        );
      })}
      {streamingText && (
        <div className="text-[13px] leading-[1.6] text-zinc-900 dark:text-zinc-100">
          <Markdown>{streamingText}</Markdown>
          <span
            className={clsx('ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle', {
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
