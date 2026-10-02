import { z } from 'zod';

import { isFlagName, isSchemaFlag } from '@plitzi/sdk-shared/flags';

import { empty, fail, flagsUri } from '../../../../helpers';
import { ruleGroup } from '../shared';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

const ruleInput = z.object({ when: ruleGroup, value: z.boolean() });

export const upsertFlagOp = z
  .object({
    type: z.literal('upsertFlag'),
    name: z.string(),
    description: z.string().optional(),
    value: z.boolean().describe('When no rule matches'),
    rules: z.array(ruleInput).optional()
  })
  .describe('Declare or replace a feature flag (guide: Feature flags).');

export type UpsertFlag = z.infer<typeof upsertFlagOp>;

export const upsertFlag = (space: Space, env: Env, op: UpsertFlag): OpResult => {
  if (!isFlagName(op.name)) {
    return fail('name', `"${op.name}" is not a flag name`, 'Letters, digits and "_", starting with a letter or "_"');
  }

  const flag = { ...(op.description ? { description: op.description } : {}), value: op.value, rules: op.rules ?? [] };
  if (!isSchemaFlag(flag)) {
    return fail(
      'rules',
      'A rule is { when: { combinator, rules: [...] }, value: true | false }',
      'Fix the rule groups'
    );
  }

  const existed = Object.hasOwn(space.schema.flags ?? {}, op.name);
  space.schema.flags = { ...space.schema.flags, [op.name]: flag };

  return { ...empty(), ...(existed ? { updated: 1 } : { created: 1 }), staleResources: [flagsUri(env)] };
};
