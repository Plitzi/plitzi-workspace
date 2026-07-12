import extractToolVisual, { VISUAL_TOOL_NAMES } from './extractToolVisual';

import type { ToolVisual } from './extractToolVisual';
import type { AiLiveStep, AiMessageStep, AiToolCall } from '@pmodules/AI/types';

export type GroupedStep<S extends AiMessageStep | AiLiveStep> =
  | { type: 'thinking'; step: Extract<S, { type: 'thinking' }>; key: string }
  | { type: 'tools'; tools: AiToolCall[]; key: string; visual?: ToolVisual }
  | { type: 'resource'; step: Extract<S, { type: 'resource' }>; key: string }
  | { type: 'text'; step: Extract<S, { type: 'text' }>; key: string };

// Collapses a flat step stream into render items: consecutive non-visual tool calls merge into one
// group, consecutive thinking steps merge into one block, and each tool group resolves its inline
// visual (preview/wireframe/design). Shared by the live entry and the persisted transcript so both
// paths group and render identically. Overloads keep each caller's concrete step type on the way
// out; the implementation works over the union, where discriminant narrowing holds without casts.
// AiLiveStep first: its thinking variant is the wider one (done/startMs), so an AiLiveStep[] must not
// fall through to the AiMessageStep overload, which would drop those fields.
function groupStepsIntoItems(steps: AiLiveStep[]): GroupedStep<AiLiveStep>[];
function groupStepsIntoItems(steps: AiMessageStep[]): GroupedStep<AiMessageStep>[];
function groupStepsIntoItems(steps: (AiMessageStep | AiLiveStep)[]): GroupedStep<AiMessageStep | AiLiveStep>[] {
  type Step = AiMessageStep | AiLiveStep;
  const items: GroupedStep<Step>[] = [];
  steps.forEach((step, i) => {
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
        const merged: Extract<Step, { type: 'thinking' }> = {
          ...last.step,
          ...step,
          text: `${last.step.text}\n\n${step.text}`,
          durationMs: (last.step.durationMs ?? 0) + (step.durationMs ?? 0)
        };
        items[items.length - 1] = { ...last, step: merged };
      } else {
        const key = 'startMs' in step ? String(step.startMs) : `t-${i}`;
        items.push({ type: 'thinking', step, key });
      }
    } else if (step.type === 'resource') {
      items.push({ type: 'resource', step, key: `res-${i}` });
    } else {
      items.push({ type: 'text', step, key: `tx-${i}` });
    }
  });

  return items.map(item => {
    if (item.type !== 'tools') {
      return item;
    }

    const visual = extractToolVisual(item.tools);
    if (!visual) {
      return item;
    }

    return { ...item, visual };
  });
}

export default groupStepsIntoItems;
