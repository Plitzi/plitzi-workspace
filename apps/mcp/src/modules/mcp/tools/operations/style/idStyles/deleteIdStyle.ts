import { z } from 'zod';

import { empty, fail } from '../../../../helpers';
import { guardKind, idsUri, idUri, MODES } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deleteIdStyleOp = z
  .object({
    type: z.literal('deleteIdStyle'),
    targetId: z.string().describe('DOM id whose id rule to remove (without the # prefix)')
  })
  .describe('Remove the id rule (`#id`) for a single element (the element keeps its own classes).');

export type DeleteIdStyle = z.infer<typeof deleteIdStyleOp>;

export const deleteIdStyle = (space: Space, env: Env, op: DeleteIdStyle): OpResult => {
  const guard = guardKind(space.style, op.targetId, 'id');
  if (guard) {
    return guard;
  }

  if (!MODES.some(mode => Object.hasOwn(space.style.platform[mode], op.targetId))) {
    return fail('missing', 'targetId', `No id rule for "${op.targetId}"`, `Read ${idsUri(env)} for what there is`);
  }

  for (const mode of MODES) {
    Reflect.deleteProperty(space.style.platform[mode], op.targetId);
  }

  return { ...empty(), deleted: 1, staleResources: [idUri(env, op.targetId), idsUri(env)] };
};
