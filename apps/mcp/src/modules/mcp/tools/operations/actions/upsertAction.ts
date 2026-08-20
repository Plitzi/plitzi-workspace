import { z } from 'zod';

import { validateActionDocument } from '@plitzi/sdk-shared/actions';

import { actionAccess, actionField, actionLimits, actionNode, actionTrigger } from './document';
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
    enabled: z.boolean().optional().describe('Defaults to true'),
    access: actionAccess,
    triggers: z.array(actionTrigger).min(1),
    input: z.record(z.string(), actionField).describe('What a caller may send. Anything undeclared is DROPPED'),
    output: z
      .record(z.string(), actionField)
      .optional()
      .describe('Derived from the `flow.output` step for typed bindings. THAT step is the contract; this is a hint'),
    credentials: z
      .array(z.string())
      .optional()
      .describe('Credentials this action may use. A STEP still names the one it uses, and sees no other'),
    connectors: z.array(z.string()).optional().describe('Connector identifiers this action may call'),
    nodes: z.array(actionNode).describe('The flow: one trigger step, then a chain linked by afterNode'),
    limits: actionLimits.optional()
  })
  .describe(
    'Create a server action, or REPLACE one whole (use patchAction to change part). An action is a declarative ' +
      'flow the SERVER runs: it reaches credentials and systems a browser must not, and the page only names it.'
  );

export type UpsertAction = z.infer<typeof upsertActionOp>;

/** The node array becomes the map the runner walks, keyed by id — the same shape an element's interactions hold. */
const toNodes = (nodes: UpsertAction['nodes']): Record<string, ElementInteraction> => {
  // Every step belongs to the flow its trigger starts. A document with no trigger is refused by the validator a
  // moment later, so the fallback here only has to be harmless.
  const trigger = nodes.find(item => item.type === 'trigger');
  const triggerId = trigger ? trigger.id : '';

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
      flowId: node.type === 'trigger' ? node.id : triggerId,
      enabled: node.enabled,
      ...(node.when === undefined ? {} : { when: node.when as ElementInteraction['when'] })
    };

    return acum;
  }, {});
};

export const toDocument = (op: UpsertAction): ActionDocument => ({
  name: op.name,
  ...(op.description === undefined ? {} : { description: op.description }),
  enabled: op.enabled ?? true,
  access: op.access,
  triggers: op.triggers,
  input: op.input,
  ...(op.output === undefined ? {} : { output: op.output }),
  ...(op.credentials === undefined ? {} : { credentials: op.credentials }),
  ...(op.connectors === undefined ? {} : { connectors: op.connectors }),
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
