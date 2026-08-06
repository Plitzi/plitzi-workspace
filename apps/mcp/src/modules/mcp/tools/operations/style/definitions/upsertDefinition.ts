import { z } from 'zod';

import { empty } from '../../../../helpers';
import { upsertCssShape } from '../shared';
import { defsUri, defUri, guardKind, writeStyleItem } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const upsertDefinitionOp = z
  .object({
    type: z.literal('upsertDefinition'),
    ref: z.string().describe('Class name you choose (kebab-case), or an existing class ref to fully replace'),
    ...upsertCssShape
  })
  .describe(
    'Create a reusable style class (CSS), or fully replace it when ref exists. Apply it by attaching ref to an ' +
      'element via its style.base. Use patchDefinition to change only some CSS.'
  );

export type UpsertDefinition = z.infer<typeof upsertDefinitionOp>;

export const upsertDefinition = (space: Space, env: Env, op: UpsertDefinition): OpResult => {
  const { type, ref, slots, ...base } = op;
  void type;
  const guard = guardKind(space.style, ref, 'class');
  if (guard) {
    return guard;
  }

  writeStyleItem(space.style, ref, base, slots, 'class', undefined);

  return { ...empty(), updated: 1, staleResources: [defUri(env, ref), defsUri(env)] };
};
