import { z } from 'zod';

import { empty } from '../../../../helpers';
import { upsertCssShape } from '../shared';
import { globalsUri, globalUri, guardKind, writeStyleItem } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

// Global element selectors — the CSS equivalent of `button { … }`: they style EVERY element of a type. Keyed by
// componentType (its name IS the type). Use these ONLY for deliberate site-wide intent ("all buttons rounded");
// to style one element, attach a class definition instead.
export const upsertGlobalStyleOp = z
  .object({
    type: z.literal('upsertGlobalStyle'),
    componentType: z.string().describe('Element type to style site-wide (e.g. "button"); affects ALL of that type'),
    ...upsertCssShape
  })
  .describe(
    'Create or fully replace the site-wide style for an element TYPE — its CSS applies to every element of that ' +
      'type. To style one element only, use upsertDefinition + attach it. Use patchGlobalStyle for a partial change.'
  );

export type UpsertGlobalStyle = z.infer<typeof upsertGlobalStyleOp>;

export const upsertGlobalStyle = (space: Space, env: Env, op: UpsertGlobalStyle): OpResult => {
  const { type, componentType, slots, ...base } = op;
  void type;
  const guard = guardKind(space.style, componentType, 'element');
  if (guard) {
    return guard;
  }

  writeStyleItem(space.style, componentType, base, slots, 'element', componentType);

  return { ...empty(), updated: 1, staleResources: [globalUri(env, componentType), globalsUri(env)] };
};
