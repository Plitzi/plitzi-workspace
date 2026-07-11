import { z } from 'zod';

import { patchCssShape } from './shared';
import { definitionToAI } from './translator';
import { defsUri, defUri, guardKind, mergePatch, writeStyleItem } from './write';
import { empty, fail } from '../../helpers';

import type { Space } from '../../helpers';
import type { OpResult } from '../../helpers';
import type { Env } from '../../types';

export const patchDefinitionOp = z.object({
  type: z.literal('patchDefinition'),
  ref: z.string(),
  ...patchCssShape
});

export type PatchDefinition = z.infer<typeof patchDefinitionOp>;

export const patchDefinition = (space: Space, env: Env, op: PatchDefinition): OpResult => {
  const guard = guardKind(space.style, op.ref, 'class');
  if (guard) {
    return guard;
  }

  const existing = definitionToAI(space.style, op.ref);
  if (!existing) {
    return fail(
      'ref',
      `Definition "${op.ref}" not found`,
      'patchDefinition only updates an existing definition; use upsertDefinition to create one'
    );
  }

  const { type, ref, slots: slotsPatch, ...basePatch } = op;
  void type;
  const { base, slots } = mergePatch(existing, basePatch, slotsPatch);
  writeStyleItem(space.style, ref, base, slots, 'class', undefined);

  return { ...empty(), updated: 1, staleResources: [defUri(env, ref), defsUri(env)] };
};
