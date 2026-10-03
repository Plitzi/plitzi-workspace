import { z } from 'zod';

import { empty, fail, flagsUri } from '../../../../helpers';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deleteFlagOp = z
  .object({ type: z.literal('deleteFlag'), name: z.string() })
  .describe('Remove a feature flag.');

export type DeleteFlag = z.infer<typeof deleteFlagOp>;

export const deleteFlag = (space: Space, env: Env, op: DeleteFlag): OpResult => {
  const flags = space.schema.flags ?? {};
  if (!Object.hasOwn(flags, op.name)) {
    return fail('name', `The space declares no flag "${op.name}"`, `Read ${flagsUri(env)}`);
  }

  const { [op.name]: _removed, ...rest } = flags;
  space.schema.flags = rest;

  return { ...empty(), deleted: 1, staleResources: [flagsUri(env)] };
};
