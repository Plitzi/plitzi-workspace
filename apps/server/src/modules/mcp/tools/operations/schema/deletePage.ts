import { z } from 'zod';

import { pageUri, pagesUri } from './write';
import { descendantIds, empty, fail, findPageByRef } from '../../../helpers';

import type { Space } from '../../../helpers';
import type { OpResult } from '../../../helpers';
import type { Env } from '../../../types';

export const deletePageOp = z.object({ type: z.literal('deletePage'), ref: z.string() });

export type DeletePage = z.infer<typeof deletePageOp>;

export const deletePage = (space: Space, env: Env, op: DeletePage): OpResult => {
  const page = findPageByRef(space.schema, op.ref);
  if (!page) {
    return fail('ref', `Page "${op.ref}" not found`, 'Read the pages resource for valid refs');
  }

  for (const id of [...descendantIds(space.schema, page.id), page.id]) {
    Reflect.deleteProperty(space.schema.flat, id);
  }

  space.schema.pages = space.schema.pages.filter(id => id !== page.id);

  return { ...empty(), deleted: 1, staleResources: [pageUri(env, op.ref), pagesUri(env)] };
};
