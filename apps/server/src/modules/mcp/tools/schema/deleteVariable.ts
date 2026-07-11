import { z } from 'zod';

import { schemaVarsUri } from './write';
import { empty } from '../../helpers';

import type { Space } from '../../helpers';
import type { OpResult } from '../../helpers';
import type { Env } from '../../types';

export const deleteVariableOp = z.object({ type: z.literal('deleteVariable'), name: z.string() });

export type DeleteVariable = z.infer<typeof deleteVariableOp>;

export const deleteVariable = (space: Space, env: Env, op: DeleteVariable): OpResult => {
  space.schema.variables = space.schema.variables.filter(v => v.name !== op.name);

  return { ...empty(), deleted: 1, staleResources: [schemaVarsUri(env)] };
};
