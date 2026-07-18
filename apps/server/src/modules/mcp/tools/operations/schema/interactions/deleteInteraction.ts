import { z } from 'zod';

import { empty, fail } from '../../../../helpers';
import { pageUri, resolveElement } from '../write';

import type { OpResult, Space } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { ElementInteraction } from '@plitzi/sdk-shared';

export const deleteInteractionOp = z
  .object({
    type: z.literal('deleteInteraction'),
    pageRef: z.string().describe('Page ref or id'),
    ref: z.string().describe('Element ref or id'),
    flowId: z.string().optional().describe('Remove the whole flow with this id (the trigger node id)'),
    nodeId: z
      .string()
      .optional()
      .describe('Remove a single step; its neighbors are re-linked. Deleting a trigger removes its flow')
  })
  .describe(
    'DESTRUCTIVE, not undoable — remove an interaction flow (by flowId) or a single step (by nodeId). Provide ' +
      'exactly one. To merely turn a step OFF without removing it, use patchInteractionNode { enabled: false } ' +
      'instead. Confirm with the user before deleting.'
  );

export type DeleteInteraction = z.infer<typeof deleteInteractionOp>;

const removeFlow = (interactions: Record<string, ElementInteraction>, flowId: string): number => {
  let deleted = 0;
  for (const [nodeId, node] of Object.entries(interactions)) {
    if ((node.flowId || node.id) === flowId) {
      Reflect.deleteProperty(interactions, nodeId);
      deleted++;
    }
  }

  return deleted;
};

export const deleteInteraction = (space: Space, env: Env, op: DeleteInteraction): OpResult => {
  if (Boolean(op.flowId) === Boolean(op.nodeId)) {
    return fail(
      'nodeId',
      'Provide exactly one of flowId or nodeId',
      'flowId removes a whole flow; nodeId removes a step'
    );
  }

  const found = resolveElement(space, env, op.pageRef, op.ref);
  if ('error' in found) {
    return found.error;
  }

  const interactions = found.el.definition.interactions;
  if (!interactions) {
    return fail('ref', `Element "${op.ref}" has no interactions`, 'Nothing to delete');
  }

  let deleted = 0;
  if (op.flowId) {
    deleted = removeFlow(interactions, op.flowId);
  } else if (op.nodeId) {
    if (!(op.nodeId in interactions)) {
      return fail(
        'nodeId',
        `Interaction node "${op.nodeId}" not found on "${op.ref}"`,
        'Read the element to list nodes'
      );
    }

    const node = interactions[op.nodeId];
    if (node.type === 'trigger') {
      deleted = removeFlow(interactions, node.flowId || node.id);
    } else {
      const before = node.beforeNode ? interactions[node.beforeNode] : undefined;
      const after = node.afterNode ? interactions[node.afterNode] : undefined;
      if (before) {
        before.afterNode = node.afterNode;
      }

      if (after) {
        after.beforeNode = node.beforeNode;
      }

      Reflect.deleteProperty(interactions, op.nodeId);
      deleted = 1;
    }
  }

  if (deleted === 0) {
    return fail('flowId', `No interaction matching "${op.flowId ?? op.nodeId}" on "${op.ref}"`, 'Nothing to delete');
  }

  if (Object.keys(interactions).length === 0) {
    Reflect.deleteProperty(found.el.definition, 'interactions');
  }

  return { ...empty(), deleted, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
