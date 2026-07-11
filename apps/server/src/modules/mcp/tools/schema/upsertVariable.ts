import { z } from 'zod';

import { scalar } from './shared';
import { schemaVarsUri } from './write';
import { empty } from '../../helpers';

import type { Space } from '../../helpers';
import type { OpResult } from '../../helpers';
import type { Env } from '../../types';
import type { SchemaVariable } from '@plitzi/sdk-shared';

export const upsertVariableOp = z.object({
  type: z.literal('upsertVariable'),
  name: z.string(),
  variableType: z.string().describe('Runtime type (text|number|...); NOT the `type` discriminator'),
  value: scalar,
  category: z.string().optional(),
  subValues: z.array(z.object({ when: z.unknown(), value: scalar })).optional()
});

export type UpsertVariable = z.infer<typeof upsertVariableOp>;

export const upsertVariable = (space: Space, env: Env, op: UpsertVariable): OpResult => {
  // The stored SchemaVariable is a discriminated union keyed by runtime `type`; the agent supplies it dynamically.
  const variable = {
    name: op.name,
    category: op.category ?? 'general',
    type: op.variableType,
    value: op.value,
    subValues: op.subValues ?? []
  } as unknown as SchemaVariable;
  const idx = space.schema.variables.findIndex(v => v.name === op.name);
  if (idx >= 0) {
    space.schema.variables[idx] = variable;

    return { ...empty(), updated: 1, staleResources: [schemaVarsUri(env)] };
  }

  space.schema.variables.push(variable);

  return { ...empty(), created: 1, staleResources: [schemaVarsUri(env)] };
};
