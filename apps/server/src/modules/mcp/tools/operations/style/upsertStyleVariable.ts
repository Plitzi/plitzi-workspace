import { z } from 'zod';

import { styleCategory, themeValue } from './shared';
import { styleVarsUri, styleVarUri } from './write';
import { empty } from '../../../helpers';

import type { Space } from '../../../helpers';
import type { OpResult } from '../../../helpers';
import type { Env } from '../../../types';

export const upsertStyleVariableOp = z.object({
  type: z.literal('upsertStyleVariable'),
  category: styleCategory,
  name: z.string(),
  value: themeValue
});

export type UpsertStyleVariable = z.infer<typeof upsertStyleVariableOp>;

export const upsertStyleVariable = (space: Space, env: Env, op: UpsertStyleVariable): OpResult => {
  const group = (space.style.variables[op.category] ??= {});
  group[op.name] = op.value;

  return { ...empty(), updated: 1, staleResources: [styleVarUri(env, op.category), styleVarsUri(env)] };
};
