import { authoringId } from './ids';

import type { StepSpec } from './types';
import type { ElementInteraction } from '@plitzi/sdk-shared';

/**
 * Where a step runs, when it did not say.
 *
 * A trigger fires on the element the flow is declared on, and an element callback with no target changes that same
 * element — in both cases the answer is the host, and writing it out is repetition that can be got wrong. A global
 * callback names its source module, which its builder fills in; a utility names nothing, and null is the answer.
 */
const hostFor = (step: StepSpec, host?: string): string | null =>
  step.type === 'trigger' || step.type === 'callback' ? (host ?? null) : null;

/**
 * One interaction flow, chained.
 *
 * The nodes are a linked list — each knows the one before and the one after, and they all carry the id of the
 * first as their `flowId`. Getting one of those three wrong produces a flow that half runs, which is why this is
 * derived from the order the steps were written in rather than declared.
 */
export const authorFlow = (path: string, steps: StepSpec[], host?: string): Record<string, ElementInteraction> => {
  const ids = steps.map((step, index) => step.id ?? `node_${authoringId(`${path}/step/${index}`)}`);
  const flowId = ids[0] ?? '';

  return steps.reduce<Record<string, ElementInteraction>>((flow, step, index) => {
    flow[ids[index]] = {
      id: ids[index],
      title: step.title ?? step.action,
      type: step.type,
      action: step.action,
      params: step.params ?? {},
      preview: step.preview ?? {},
      elementId: step.on ?? hostFor(step, host),
      beforeNode: index === 0 ? '' : ids[index - 1],
      afterNode: index === steps.length - 1 ? '' : ids[index + 1],
      flowId,
      enabled: step.enabled ?? true,
      ...(step.when ? { when: step.when } : {})
    };

    return flow;
  }, {});
};

/**
 * Names a step, so a later one can read what it produced.
 *
 * A running flow keeps its scope keyed by node id, which means `{{ login.values.username }}` resolves only when
 * the step that produced it is called `login`. Left unnamed, a step's id is derived from where it sits — unique,
 * and nothing an author can write down, which is the same as saying its result is unreachable.
 */
export const named = (id: string, step: StepSpec): StepSpec => ({ ...step, id });

export const authorFlows = (path: string, flows: StepSpec[][], host?: string): Record<string, ElementInteraction> =>
  flows.reduce<Record<string, ElementInteraction>>(
    (all, steps, index) => ({ ...all, ...authorFlow(`${path}/flow/${index}`, steps, host) }),
    {}
  );
