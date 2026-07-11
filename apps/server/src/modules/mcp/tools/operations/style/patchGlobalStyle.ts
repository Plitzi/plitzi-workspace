import { z } from 'zod';

import { patchCssShape } from './shared';
import { globalStyleToAI } from './translator';
import { globalsUri, globalUri, guardKind, mergePatch, writeStyleItem } from './write';
import { empty, fail } from '../../../helpers';

import type { Space } from '../../../helpers';
import type { OpResult } from '../../../helpers';
import type { Env } from '../../../types';

export const patchGlobalStyleOp = z
  .object({
    type: z.literal('patchGlobalStyle'),
    componentType: z.string().describe('Element type whose global style to merge into; affects ALL of that type'),
    ...patchCssShape
  })
  .describe(
    'Partially update the site-wide style for an element type: CSS is merged (a null value removes a property). ' +
      'Never creates — use upsertGlobalStyle for that.'
  );

export type PatchGlobalStyle = z.infer<typeof patchGlobalStyleOp>;

export const patchGlobalStyle = (space: Space, env: Env, op: PatchGlobalStyle): OpResult => {
  const guard = guardKind(space.style, op.componentType, 'element');
  if (guard) {
    return guard;
  }

  const existing = globalStyleToAI(space.style, op.componentType);
  if (!existing) {
    return fail(
      'componentType',
      `No global style for "${op.componentType}"`,
      'patchGlobalStyle only updates an existing global; use upsertGlobalStyle to create one'
    );
  }

  const { type, componentType, slots: slotsPatch, ...basePatch } = op;
  void type;
  const { base, slots } = mergePatch(existing, basePatch, slotsPatch);
  writeStyleItem(space.style, componentType, base, slots, 'element', componentType);

  return { ...empty(), updated: 1, staleResources: [globalUri(env, componentType), globalsUri(env)] };
};
