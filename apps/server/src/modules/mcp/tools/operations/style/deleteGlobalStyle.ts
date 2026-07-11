import { z } from 'zod';

import { globalsUri, globalUri, guardKind, MODES } from './write';
import { empty } from '../../../helpers';

import type { Space } from '../../../helpers';
import type { OpResult } from '../../../helpers';
import type { Env } from '../../../types';

export const deleteGlobalStyleOp = z
  .object({
    type: z.literal('deleteGlobalStyle'),
    componentType: z.string().describe('Element type whose site-wide style to remove')
  })
  .describe('Remove the site-wide style for an element type (elements of that type keep their own classes).');

export type DeleteGlobalStyle = z.infer<typeof deleteGlobalStyleOp>;

export const deleteGlobalStyle = (space: Space, env: Env, op: DeleteGlobalStyle): OpResult => {
  const guard = guardKind(space.style, op.componentType, 'element');
  if (guard) {
    return guard;
  }

  for (const mode of MODES) {
    Reflect.deleteProperty(space.style.platform[mode], op.componentType);
  }

  return { ...empty(), deleted: 1, staleResources: [globalUri(env, op.componentType), globalsUri(env)] };
};
