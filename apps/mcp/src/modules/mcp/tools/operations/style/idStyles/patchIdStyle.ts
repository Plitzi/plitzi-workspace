import { z } from 'zod';

import { empty, fail } from '../../../../helpers';
import { patchCssShape } from '../shared';
import { idStyleToAI } from '../translator';
import { guardKind, idsUri, idUri, mergePatch, writeStyleItem } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const patchIdStyleOp = z
  .object({
    type: z.literal('patchIdStyle'),
    targetId: z.string().describe('DOM id whose id rule to merge into (without the # prefix)'),
    ...patchCssShape
  })
  .describe(
    'Partially update the CSS of an id rule (`#id`): CSS is merged (a null value removes a property). Never ' +
      'creates — use upsertIdStyle for that.'
  );

export type PatchIdStyle = z.infer<typeof patchIdStyleOp>;

export const patchIdStyle = (space: Space, env: Env, op: PatchIdStyle): OpResult => {
  const guard = guardKind(space.style, op.targetId, 'id');
  if (guard) {
    return guard;
  }

  const existing = idStyleToAI(space.style, op.targetId);
  if (!existing) {
    return fail(
      'targetId',
      `No id rule for "${op.targetId}"`,
      'patchIdStyle only updates an existing id rule; use upsertIdStyle to create one'
    );
  }

  const { type, targetId, slots: slotsPatch, ...basePatch } = op;
  void type;
  const { base, slots } = mergePatch(existing, basePatch, slotsPatch);
  writeStyleItem(space.style, targetId, base, slots, 'id', undefined);

  return { ...empty(), updated: 1, staleResources: [idUri(env, targetId), idsUri(env)] };
};
