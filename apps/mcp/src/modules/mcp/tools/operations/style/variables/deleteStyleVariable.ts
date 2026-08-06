import { z } from 'zod';

import { empty } from '../../../../helpers';
import { styleCategory } from '../shared';
import { styleVarsUri, styleVarUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deleteStyleVariableOp = z
  .object({
    type: z.literal('deleteStyleVariable'),
    category: styleCategory,
    name: z.string().describe('Token name without the -- prefix')
  })
  .describe('Delete a design token by category + name.');

export type DeleteStyleVariable = z.infer<typeof deleteStyleVariableOp>;

export const deleteStyleVariable = (space: Space, env: Env, op: DeleteStyleVariable): OpResult => {
  const group = space.style.variables[op.category];
  if (group) {
    Reflect.deleteProperty(group, op.name);
  }

  return { ...empty(), deleted: 1, staleResources: [styleVarUri(env, op.category), styleVarsUri(env)] };
};
