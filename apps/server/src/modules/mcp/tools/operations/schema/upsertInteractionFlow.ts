import { z } from 'zod';

import { interactionNode } from './shared';
import { pageUri, resolveElement } from './write';
import { empty, materializeFlow } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { ElementInteraction } from '@plitzi/sdk-shared';

export const upsertInteractionFlowOp = z
  .object({
    type: z.literal('upsertInteractionFlow'),
    pageRef: z.string().describe('Page ref or id'),
    ref: z.string().describe('Element ref or id'),
    flowId: z.string().optional().describe('Existing flow to replace (the trigger node id). Omit to create a new flow'),
    nodes: z
      .array(interactionNode)
      .min(1)
      .describe('Ordered steps of the flow: the FIRST must be a trigger, the rest run after it in order')
  })
  .describe(
    'Create or replace one interaction flow on an element from an ordered list of steps. The stored ' +
      'beforeNode/afterNode/flowId links are computed for you — pass the steps in execution order. To edit a ' +
      'single step in place use patchInteractionNode.'
  );

export type UpsertInteractionFlow = z.infer<typeof upsertInteractionFlowOp>;

export const upsertInteractionFlow = (space: Space, env: Env, op: UpsertInteractionFlow): OpResult => {
  const found = resolveElement(space, env, op.pageRef, op.ref);
  if ('error' in found) {
    return found.error;
  }

  // When replacing a known flow, pin the trigger id to it so the recomputed flowId matches and the old nodes are
  // swapped out cleanly (rather than leaving a duplicate flow behind).
  const nodes = op.flowId && !op.nodes[0].id ? [{ ...op.nodes[0], id: op.flowId }, ...op.nodes.slice(1)] : op.nodes;
  const { flowId, record } = materializeFlow(nodes, found.el.id);

  const interactions: Record<string, ElementInteraction> = found.el.definition.interactions ?? {};
  const targetFlow = op.flowId ?? flowId;
  let replaced = false;
  for (const [nodeId, node] of Object.entries(interactions)) {
    if ((node.flowId || node.id) === targetFlow) {
      Reflect.deleteProperty(interactions, nodeId);
      replaced = true;
    }
  }

  Object.assign(interactions, record);
  found.el.definition.interactions = interactions;

  return {
    ...empty(),
    ...(replaced ? { updated: 1 } : { created: 1 }),
    staleResources: [pageUri(env, op.pageRef)],
    elementRefs: [op.ref]
  };
};
