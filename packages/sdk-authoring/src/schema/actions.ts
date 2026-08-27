import { authorFlow } from './flows';

import type { StepSpec } from './types';
import type { ActionAccess, ActionEntry, ActionField, ActionTriggerParams } from '@plitzi/sdk-shared';

/**
 * Authoring a server action.
 *
 * An action is the SAME document an element's flows are — a map of steps chained through
 * `beforeNode`/`afterNode`/`flowId` — which is why it is assembled here rather than beside the runtime that
 * executes it. What the vocabulary MEANS (who may start a run, what a field is, how a trigger's params are read
 * back) belongs to `@plitzi/sdk-shared`, and this writes documents in it.
 *
 * Three things stop being written twice:
 *
 * - **The chain.** `beforeNode`, `afterNode`, `flowId` and `elementId` are derived, as they are everywhere else.
 *   Hand-written they are the classic half-running flow: a chain pointing at a node that moved runs the steps it
 *   still reaches and silently drops the rest.
 * - **The input contract.** A step that names no params takes the trigger's declared fields, one for one — so
 *   adding a field to the contract cannot leave the step that consumes it behind. That gap is invisible from both
 *   ends: the caller's value passes validation, is dropped before the task, and the task sees `undefined`.
 * - **The stringly params.** `access` is the typed {@link ActionAccess}, `input` is a field map, and the flat
 *   string shape the flow editor stores is produced here.
 */

/** How a webhook proves who is calling it. Naming the credential is what turns verification on. */
export interface WebhookVerifySpec {
  credential: string;
  header?: string;
  algorithm?: 'sha256' | 'sha1';
  secretField?: string;
  timestampHeader?: string;
  toleranceSeconds?: number;
}

interface TriggerCommon {
  /** This way in's node id. Defaults to `start` for a lone trigger, and to the kind itself when there are several. */
  id?: string;
  /** What a caller may send THIS way. Anything undeclared is dropped before a single step runs. */
  input?: Record<string, ActionField>;
  /** An action is on when a way into it is: there is no second switch beside the flow. */
  enabled?: boolean;
}

/**
 * Who may start a run this way. `'public'` and `'session'` are the two that carry nothing else.
 *
 * Required on every kind but `schedule`, and by the TYPE rather than by a check at run time: a trigger with no
 * rule is refused by the runner, so the alternative is a way in that authors fine and answers `forbidden` to
 * everybody. A clock has no caller and states none.
 */
export type AccessSpec = ActionAccess | 'public' | 'session';

export type ActionTriggerSpec =
  | (TriggerCommon & { type: 'call'; access: AccessSpec })
  | (TriggerCommon & { type: 'render'; access: AccessSpec; cacheSeconds?: number })
  | (TriggerCommon & { type: 'webhook'; access: AccessSpec; verify?: WebhookVerifySpec })
  /** `name` is what the deployment mounts this trigger under, and there is nothing to mount without it. */
  | (TriggerCommon & { type: 'custom'; access: AccessSpec; name: string })
  | (TriggerCommon & { type: 'schedule'; cron: string; timezone?: string });

export interface ActionStepSpec {
  /**
   * What later steps and the output call this one by — `{{ rate.total }}` resolves only when the step that
   * produced it is named `rate`. Required, unlike an element flow's: an action's whole answer is read by name.
   */
  id: string;
  /** The task this step runs, e.g. `http.request`, `kv.increment`, or one this deployment registered. */
  task: string;
  /**
   * Left out, the trigger's declared input is passed straight through — `{ slug: '{{input.slug}}' }` for every
   * field it declares. Write it when the step takes anything else: a constant, an earlier step's result, a value
   * interpolated into a larger string.
   */
  params?: Record<string, unknown>;
  /** Runs only when this evaluates true against the flow scope. */
  when?: StepSpec['when'];
  /** The credential whose values exist only while this step's params render. */
  credential?: string;
  enabled?: boolean;
}

export interface ActionSpec {
  id: string;
  name: string;
  description?: string;
  /** One way in, or several — a flow reachable both from a page and from a webhook answers each on its own terms. */
  trigger: ActionTriggerSpec | ActionTriggerSpec[];
  steps: ActionStepSpec[];
  /**
   * What leaves the server, as the output step's template. Defaults to the last step's whole result.
   *
   * This is the contract, and it is the only one: a field the caller must never see is a field no token here
   * names. An unquoted token keeps its type (`{{ rate.total }}` is a number), a quoted one is text.
   */
  output?: string;
}

const accessParams = (access: AccessSpec | undefined): Partial<ActionTriggerParams> => {
  if (!access) {
    return {};
  }

  const resolved: ActionAccess = typeof access === 'string' ? { mode: access } : access;

  return resolved.mode === 'role'
    ? { access: 'role', permissions: resolved.permissions.join(',') }
    : { access: resolved.mode };
};

const verifyParams = (verify: WebhookVerifySpec | undefined): Partial<ActionTriggerParams> =>
  verify
    ? {
        signatureCredential: verify.credential,
        ...(verify.header ? { signatureHeader: verify.header } : {}),
        ...(verify.algorithm ? { signatureAlgorithm: verify.algorithm } : {}),
        ...(verify.secretField ? { signatureSecretField: verify.secretField } : {}),
        ...(verify.timestampHeader ? { signatureTimestampHeader: verify.timestampHeader } : {}),
        ...(verify.toleranceSeconds === undefined ? {} : { signatureToleranceSeconds: String(verify.toleranceSeconds) })
      }
    : {};

const triggerStep = (spec: ActionTriggerSpec, id: string): StepSpec => ({
  id,
  type: 'trigger',
  action: spec.type,
  params: {
    ...('access' in spec ? accessParams(spec.access) : {}),
    ...(spec.input ? { input: JSON.stringify(spec.input) } : {}),
    ...(spec.type === 'render' && spec.cacheSeconds !== undefined ? { cacheSeconds: String(spec.cacheSeconds) } : {}),
    ...(spec.type === 'schedule' ? { cron: spec.cron, ...(spec.timezone ? { timezone: spec.timezone } : {}) } : {}),
    ...(spec.type === 'custom' ? { name: spec.name } : {}),
    ...(spec.type === 'webhook' ? verifyParams(spec.verify) : {})
  },
  ...(spec.enabled === undefined ? {} : { enabled: spec.enabled })
});

/**
 * The declared input, passed through one field at a time.
 *
 * Only when every way in declares the SAME contract — with two that differ there is no single right answer, and
 * picking one would wire a step to fields the other trigger never accepts.
 */
const passthroughParams = (triggers: ActionTriggerSpec[], actionId: string, stepId: string): Record<string, string> => {
  const contracts = triggers.map(trigger =>
    Object.keys(trigger.input ?? {})
      .sort()
      .join(',')
  );
  if (new Set(contracts).size > 1) {
    throw new Error(
      `Step "${stepId}" of action "${actionId}" names no params, but this action's ways in declare different inputs, so there is nothing to pass through. Write the step's params.`
    );
  }

  return Object.fromEntries(Object.keys(triggers[0]?.input ?? {}).map(field => [field, `{{input.${field}}}`]));
};

const assertUniqueIds = (ids: string[], actionId: string): void => {
  const seen = new Set<string>();
  for (const id of ids) {
    // The node map is keyed by id, so a repeat does not duplicate a step — it REPLACES one, and the flow that
    // results is shorter than the one that was written with nothing saying so.
    if (seen.has(id)) {
      throw new Error(`Action "${actionId}" names the step "${id}" twice. A flow's steps are keyed by id.`);
    }

    seen.add(id);
  }
};

/**
 * Build an action document from a declaration.
 *
 * ```ts
 * defineAction({
 *   id: 'update-post',
 *   name: 'Update a post',
 *   trigger: { type: 'call', access: { mode: 'role', permissions: ['postPublish'] }, input: {
 *     slug: { type: 'text', required: true, label: 'Slug' },
 *     title: { type: 'text', label: 'Title' }
 *   } },
 *   steps: [{ id: 'updated', task: 'blog.updatePost' }]
 * });
 * ```
 */
export const defineAction = (spec: ActionSpec): ActionEntry => {
  const triggers = Array.isArray(spec.trigger) ? spec.trigger : [spec.trigger];
  if (triggers.length === 0) {
    throw new Error(`Action "${spec.id}" declares no way in, so nothing can ever start it.`);
  }

  if (spec.steps.length === 0) {
    throw new Error(`Action "${spec.id}" declares no steps.`);
  }

  const triggerIds = triggers.map(trigger => trigger.id ?? (triggers.length === 1 ? 'start' : trigger.type));
  const last = spec.steps[spec.steps.length - 1];
  assertUniqueIds([...triggerIds, ...spec.steps.map(step => step.id), 'answer'], spec.id);

  const steps: StepSpec[] = [
    ...triggers.map((trigger, index) => triggerStep(trigger, triggerIds[index])),
    ...spec.steps.map(step => ({
      id: step.id,
      type: 'task' as const,
      action: step.task,
      params: {
        ...(step.params ?? passthroughParams(triggers, spec.id, step.id)),
        ...(step.credential ? { credential: step.credential } : {})
      },
      ...(step.when ? { when: step.when } : {}),
      ...(step.enabled === undefined ? {} : { enabled: step.enabled })
    })),
    { id: 'answer', type: 'task', action: 'flow.output', params: { values: spec.output ?? `{{ ${last.id} }}` } }
  ];

  return {
    id: spec.id,
    document: {
      name: spec.name,
      ...(spec.description ? { description: spec.description } : {}),
      nodes: authorFlow(steps)
    }
  };
};
