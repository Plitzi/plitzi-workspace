import { z } from 'zod';

import { empty } from '../../../../helpers';
import { upsertCssShape } from '../shared';
import { guardKind, idsUri, idUri, writeStyleItem } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

// Id rules — the CSS equivalent of `#id { … }`: they style the ONE element whose DOM `id` attribute equals the
// targetId. Give that element an `id` attribute (via its props) for the rule to bite. Prefer a class definition
// whenever the styling could be reused; reach for an id rule only to target a single, specifically-identified node.
export const upsertIdStyleOp = z
  .object({
    type: z.literal('upsertIdStyle'),
    targetId: z.string().describe('DOM id of the element to style (without the # prefix); matches its `id` attribute'),
    ...upsertCssShape
  })
  .describe(
    'Create or fully replace the CSS for a single element addressed by its DOM id (`#id`). The element must carry ' +
      'that `id` attribute. To style by reusable class instead, use upsertDefinition. Use patchIdStyle for a ' +
      'partial change.'
  );

export type UpsertIdStyle = z.infer<typeof upsertIdStyleOp>;

export const upsertIdStyle = (space: Space, env: Env, op: UpsertIdStyle): OpResult => {
  const { type, targetId, slots, ...base } = op;
  void type;
  const guard = guardKind(space.style, targetId, 'id');
  if (guard) {
    return guard;
  }

  writeStyleItem(space.style, targetId, base, slots, 'id', undefined);

  return { ...empty(), updated: 1, staleResources: [idUri(env, targetId), idsUri(env)] };
};
