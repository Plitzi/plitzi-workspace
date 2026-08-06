import { z } from 'zod';

import { empty } from '../../../../helpers';
import { upsertCssShape } from '../shared';
import { defsUri, defUri, guardKind, writeStyleItem } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

// One entry is exactly an upsertDefinition without its `type`/`ref` — the ref is the key it is filed under.
const definitionBody = z.object(upsertCssShape);

export const upsertDefinitionsOp = z
  .object({
    type: z.literal('upsertDefinitions'),
    definitions: z
      .record(z.string(), definitionBody)
      .describe('Every class keyed by the class name you choose (kebab-case); the value is that class CSS')
  })
  .describe(
    'Create or fully replace SEVERAL style classes in ONE operation — identical to a run of upsertDefinition, ' +
      'minus the repeated envelope, so prefer it whenever a batch declares more than one class. Apply each by ' +
      'attaching its name to an element via style.base. Use patchDefinition to change only some CSS of one class.'
  );

export type UpsertDefinitions = z.infer<typeof upsertDefinitionsOp>;

/** Writes each entry exactly as {@link upsertDefinition} would. Entries are independent: one bad class reports its
 *  own error under `definitions.<ref>` and the rest still write — nothing is persisted while the batch carries
 *  errors, so a partial write cannot escape. */
export const upsertDefinitions = (space: Space, env: Env, op: UpsertDefinitions): OpResult => {
  const result: OpResult = { ...empty(), staleResources: [defsUri(env)] };
  const errors = [];

  for (const [ref, { slots, ...base }] of Object.entries(op.definitions)) {
    const guard = guardKind(space.style, ref, 'class');
    if (guard?.errors) {
      errors.push(...guard.errors.map(error => ({ ...error, path: `definitions.${ref}` })));
      continue;
    }

    writeStyleItem(space.style, ref, base, slots, 'class', undefined);
    result.updated += 1;
    result.staleResources.push(defUri(env, ref));
  }

  return errors.length > 0 ? { ...result, errors } : result;
};
