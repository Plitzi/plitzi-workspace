import { z } from 'zod';

import { interactionNode } from './shared';
import { ensureIdRef, pageUri, resolveElement, resolveTargetRef } from './write';
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
      'beforeNode/afterNode/flowId links are computed for you — pass the steps in execution order. For a ' +
      'globalCallback (addNotification, setState, navigate, auth*, *CollectionRecord) OMIT elementId: it is ' +
      'registered on a source module, not the host element, and the MCP sets the right source and fills the ' +
      'default param values for you. To edit a single step in place use patchInteractionNode.'
  );

export type UpsertInteractionFlow = z.infer<typeof upsertInteractionFlowOp>;

export const upsertInteractionFlow = (space: Space, env: Env, op: UpsertInteractionFlow): OpResult => {
  const found = resolveElement(space, env, op.pageRef, op.ref);
  if ('error' in found) {
    return found.error;
  }

  // The runtime keys triggers/callbacks by idRef, so the host element needs one. Rather than fail and make the
  // agent assign it first, mint a free ref for an element that has none and carry on.
  const ownerRef = ensureIdRef(space, found.el);

  // When replacing a known flow, pin the trigger id to it so the recomputed flowId matches and the old nodes are
  // swapped out cleanly (rather than leaving a duplicate flow behind).
  const pinned = op.flowId && !op.nodes[0].id ? [{ ...op.nodes[0], id: op.flowId }, ...op.nodes.slice(1)] : op.nodes;
  const nodes = pinned.map(node =>
    node.elementId === undefined ? node : { ...node, elementId: resolveTargetRef(space, node.elementId) }
  );

  // A node defaulting to its own element carries the owner ref — the key the runtime registers the callback under.
  const { flowId, record } = materializeFlow(nodes, ownerRef);

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
