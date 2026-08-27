import { isValidElementId } from '@plitzi/sdk-schema/helpers/elementId';

import type { StepSpec } from './types';
import type { Rule, RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
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
 * What a step may be called, and that no two are called the same.
 *
 * A flow is a MAP keyed by step id, so a repeat does not add a step — it replaces one, and the flow that runs is
 * shorter than the one that was written with nothing saying so. The charset is the id charset: a later step reads
 * an earlier one as `{{ <id>.field }}`, and a '.' would split that path into two segments.
 */
const assertStepIds = (ids: string[], where: string): void => {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!isValidElementId(id)) {
      throw new Error(
        `Step "${id}" in ${where} is not a valid name: start with a letter, then letters, numbers, hyphens and underscores. A later step reads this one as {{ ${id}.field }}.`
      );
    }

    if (seen.has(id)) {
      throw new Error(`${where} names the step "${id}" twice. A flow's steps are keyed by id, so the second wins.`);
    }

    seen.add(id);
  }
};

/**
 * One interaction flow, chained.
 *
 * The nodes are a linked list — each knows the one before and the one after, and they all carry the id of the
 * first as their `flowId`. Getting one of those three wrong produces a flow that half runs, which is why this is
 * derived from the order the steps were written in rather than declared.
 */
export const authorFlow = (
  steps: StepSpec[],
  host?: string,
  // Shared by every flow on the same element: they all land in one `interactions` record, so a counter per flow
  // would have the second flow's `navigate` overwrite the first one's.
  counters: Map<string, number> = new Map()
): Record<string, ElementInteraction> => {
  // A step's output is addressed as `{{ <id>.field }}` from every later step, so an unnamed one still gets a name
  // worth reading — `navigate-2` — counted per action, which is what a person would have called it anyway.
  const named = new Set(steps.map(step => step.id).filter(Boolean) as string[]);
  const ids = steps.map(step => {
    if (step.id) {
      return step.id;
    }

    const base = step.action.replace(/[^A-Za-z0-9]/g, '') || step.type;
    let next = (counters.get(base) ?? 0) + 1;
    // Past anything the author named in the same flow: a minted `navigate-1` landing on a step already called
    // `navigate-1` would not read as a duplicate, it would silently be the same entry of the record.
    while (named.has(`${base}-${next}`)) {
      next += 1;
    }

    counters.set(base, next);

    return `${base}-${next}`;
  });

  assertStepIds(ids, host ? `the flow on "${host}"` : 'this flow');
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
 * the step that produced it is called `login`. Left unnamed, a step is still named — `<action>-<n>` — so its result
 * is reachable; naming it yourself is how it becomes readable.
 */
export const named = (id: string, step: StepSpec): StepSpec => ({ ...step, id });

/**
 * Runs a step only when a rule holds.
 *
 * The pair to {@link named}: that one lets a later step READ what an earlier one produced, this one lets it decide
 * whether to run at all. Both are about the same thing — a flow is a list, and everything conditional in it is
 * expressed on the steps rather than by branching the list.
 *
 * Written out, a condition is a query-builder group: a combinator and a list of rules, four levels of nesting for
 * "did that work?". Here it is the rule.
 */
export const when = (rules: Rule | Rule[], step: StepSpec, combinator: 'and' | 'or' = 'and'): StepSpec => {
  const group: RuleGroup = { combinator, rules: Array.isArray(rules) ? rules : [rules] };

  return { ...step, when: group };
};

/**
 * Runs a step only if the named server action completed.
 *
 * `<id>.status` is the field, and it is only in the flow scope at all when that step ran with `mode: 'await'` and
 * was {@link named} — the same two conditions that make `{{<id>.output.*}}` readable.
 */
export const whenSucceeded = (stepId: string, step: StepSpec): StepSpec =>
  when({ field: `${stepId}.status`, operator: '=', value: 'completed' }, step);

/**
 * Runs a step only if the named server action did NOT complete.
 *
 * Every outcome that is not `completed`, which is deliberate: a run can come back `failed`, `skipped` or
 * `aborted`, and to the page they are one event — it did not work, and the reason is in `{{<id>.reason}}`.
 * Matching only `failed` is how the other two end up silently doing nothing.
 */
export const whenFailed = (stepId: string, step: StepSpec): StepSpec =>
  when({ field: `${stepId}.status`, operator: '!=', value: 'completed' }, step);

export const authorFlows = (flows: StepSpec[][], host?: string): Record<string, ElementInteraction> => {
  const counters = new Map<string, number>();

  return flows.reduce<Record<string, ElementInteraction>>(
    (all, steps) => ({ ...all, ...authorFlow(steps, host, counters) }),
    {}
  );
};
