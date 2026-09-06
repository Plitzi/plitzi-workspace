import { z } from 'zod';

import { NULLISH_ELEMENT_IDS, empty, fail } from '../../../../helpers';
import { interactionNode } from '../shared';
import { pageUri, resolveElement, resolveTargetRef } from '../write';

import type { OpResult, Space } from '../../../../helpers';
import type { Env } from '../../../../types';

const { title, action, params, enabled, when, elementId, preview } = interactionNode.shape;

export const patchInteractionNodeOp = z
  .object({
    type: z.literal('patchInteractionNode'),
    pageRef: z.string().describe('The page, by name'),
    ref: z.string().describe('The element, by name'),
    nodeId: z.string().describe('Id of the interaction node to update'),
    title: title.optional(),
    action: action.optional(),
    params: params.describe('Merged onto the node params: listed keys change, others are preserved'),
    enabled,
    when,
    elementId,
    preview
  })
  .describe(
    'Partially update ONE step of a flow (found by nodeId): only the fields you pass change, the order/links are ' +
      'untouched. This is how you DISABLE a step without removing it — { enabled: false } keeps it in the flow. ' +
      'deleteInteraction is for actually removing one. Fails if the node does not exist.'
  );

export type PatchInteractionNode = z.infer<typeof patchInteractionNodeOp>;

export const patchInteractionNode = (space: Space, env: Env, op: PatchInteractionNode): OpResult => {
  const found = resolveElement(space, env, op.pageRef, op.ref);
  if ('error' in found) {
    return found.error;
  }

  const node = found.el.definition.interactions?.[op.nodeId];
  if (!node) {
    return fail('nodeId', `Interaction node "${op.nodeId}" not found on "${op.ref}"`, 'Read the element to list nodes');
  }

  if (op.title !== undefined) {
    node.title = op.title;
  }

  if (op.action !== undefined) {
    node.action = op.action;
  }

  if (op.params !== undefined) {
    node.params = { ...node.params, ...op.params };
  }

  if (op.enabled !== undefined) {
    node.enabled = op.enabled;
  }

  if (op.when !== undefined) {
    node.when = op.when;
  }

  if (op.elementId !== undefined) {
    node.elementId = resolveTargetRef(space, op.elementId);
  }

  // A utility is registered on NO element — keep its elementId null regardless of what was patched in or already
  // stored (the builder writes the string "undefined" here; the agent may wrongly pin the host). Normalize a
  // stringified nullish value on other node types to a real null too.
  if (node.type === 'utility') {
    node.elementId = null;
  } else if (typeof node.elementId === 'string' && NULLISH_ELEMENT_IDS.has(node.elementId)) {
    node.elementId = null;
  }

  if (op.preview !== undefined) {
    node.preview = op.preview;
  }

  return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
