import { z } from 'zod';

import { styleCategory } from './shared';
import { styleVarsUri, styleVarUri } from './write';
import { empty } from '../../helpers';

import type { Space } from '../../helpers';
import type { OpResult } from '../../helpers';
import type { Env } from '../../types';

export const deleteStyleVariableOp = z.object({
  type: z.literal('deleteStyleVariable'),
  category: styleCategory,
  name: z.string()
});

export type DeleteStyleVariable = z.infer<typeof deleteStyleVariableOp>;

export const deleteStyleVariable = (space: Space, env: Env, op: DeleteStyleVariable): OpResult => {
  const group = space.style.variables[op.category];
  if (group) {
    Reflect.deleteProperty(group, op.name);
  }

  return { ...empty(), deleted: 1, staleResources: [styleVarUri(env, op.category), styleVarsUri(env)] };
};
