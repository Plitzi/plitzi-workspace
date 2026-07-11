import { z } from 'zod';

import { defsUri, defUri, guardKind, MODES } from './write';
import { empty } from '../../helpers';

import type { Space } from '../../helpers';
import type { OpResult } from '../../helpers';
import type { Env } from '../../types';

export const deleteDefinitionOp = z.object({ type: z.literal('deleteDefinition'), ref: z.string() });

export type DeleteDefinition = z.infer<typeof deleteDefinitionOp>;

export const deleteDefinition = (space: Space, env: Env, op: DeleteDefinition): OpResult => {
  const guard = guardKind(space.style, op.ref, 'class');
  if (guard) {
    return guard;
  }

  for (const mode of MODES) {
    Reflect.deleteProperty(space.style.platform[mode], op.ref);
  }

  return { ...empty(), deleted: 1, staleResources: [defUri(env, op.ref), defsUri(env)] };
};
