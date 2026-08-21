import { z } from 'zod';

import { validateActionDocument } from '@plitzi/sdk-shared/actions';

import { actionField, actionLimits, actionNode } from './document';
import { actionUri, actionsUri, empty, fail, findActionEntry } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { ActionDocument, ElementInteraction } from '@plitzi/sdk-shared';

export const upsertActionOp = z
  .object({
    type: z.literal('upsertAction'),
    ref: z
      .string()
      .describe(
        'Stable identifier a `runServerAction` step stores, e.g. "send-quote". Never reused for another action'
      ),
    name: z.string().describe('Human name shown in the builder'),
    description: z.string().optional(),
    output: z
      .record(z.string(), actionField)
      .optional()
      .describe('Derived from the `flow.output` step for typed bindings. THAT step is the contract; this is a hint'),
    nodes: z
      .array(actionNode)
      .describe('The flow: a trigger step per way in, each heading a chain linked by afterNode'),
    limits: actionLimits.optional()
  })
  .describe(
    'Create a server action, or REPLACE one whole (use patchAction to change part). An action is a declarative ' +
      'flow the SERVER runs — the same node map an element\'s interactions are, with tasks instead of callbacks. ' +
      'What starts it, who may, what they send and whether it runs at all live on its TRIGGER steps, not ' +
      'beside the flow.'
  );

export type UpsertAction = z.infer<typeof upsertActionOp>;

/**
 * The node array becomes the map the runner walks, keyed by id — the same shape an element's interactions hold.
 *
 * `flowId` is stamped by walking each trigger's chain, because an action may hold several: a step belongs to the
 * flow whose trigger reaches it, and guessing "the first trigger" would label a webhook's steps as the call's.
 */
const toNodes = (nodes: UpsertAction['nodes']): Record<string, ElementInteraction> => {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const flowOf = new Map<string, string>();
  nodes
    .filter(node => node.type === 'trigger')
    .forEach(trigger => {
      let current: string | undefined = trigger.id;
      while (current && !flowOf.has(current)) {
        flowOf.set(current, trigger.id);
        current = byId.get(current)?.afterNode || undefined;
      }
    });

  return nodes.reduce<Record<string, ElementInteraction>>((acum, node) => {
    acum[node.id] = {
      id: node.id,
      title: node.title,
      type: node.type,
      action: node.action,
      params: node.params,
      preview: {},
      elementId: null,
      beforeNode: node.beforeNode,
      afterNode: node.afterNode,
      flowId: flowOf.get(node.id) ?? node.id,
      enabled: node.enabled,
      ...(node.when === undefined ? {} : { when: node.when as ElementInteraction['when'] })
    };

    return acum;
  }, {});
};

export const toDocument = (op: UpsertAction): ActionDocument => ({
  name: op.name,
  ...(op.description === undefined ? {} : { description: op.description }),
  ...(op.output === undefined ? {} : { output: op.output }),
  nodes: toNodes(op.nodes),
  ...(op.limits === undefined ? {} : { limits: op.limits })
});

export const upsertAction = (space: Space, env: Env, op: UpsertAction): OpResult => {
  const document = toDocument(op);
  // The same validator the builder form and the GraphQL mutation run. Checked here so the agent hears WHICH rule it
  // broke while it can still fix it, rather than storing a flow the runner refuses when a visitor clicks.
  const report = validateActionDocument(document);
  if (!report.valid) {
    return fail('nodes', `Invalid action: ${report.errors.map(issue => issue.message).join('; ')}`, '', []);
  }

  const existing = findActionEntry(space, op.ref);
  const stale = [actionsUri(env), actionUri(env, op.ref)];
  if (existing) {
    existing.document = document;

    return { ...empty(), updated: 1, staleResources: stale };
  }

  space.actions.push({ id: op.ref, document });

  return { ...empty(), created: 1, staleResources: stale };
};
