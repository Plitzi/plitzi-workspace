import { z } from 'zod';

import { empty, fail } from '../../../../helpers';
import { schemaVarsUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deleteVariableOp = z
  .object({ type: z.literal('deleteVariable'), name: z.string().describe('Name of the schema variable to delete') })
  .describe('Delete a space-level schema variable by name.');

export type DeleteVariable = z.infer<typeof deleteVariableOp>;

export const deleteVariable = (space: Space, env: Env, op: DeleteVariable): OpResult => {
  if (!space.schema.variables.some(variable => variable.name === op.name)) {
    return fail(
      'missing',
      'name',
      `No variable "${op.name}"`,
      `Read ${schemaVarsUri(env)} for the variables the space has`
    );
  }

  space.schema.variables = space.schema.variables.filter(variable => variable.name !== op.name);

  return { ...empty(), deleted: 1, staleResources: [schemaVarsUri(env)] };
};
