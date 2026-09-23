import { z } from 'zod';

import { descendants } from '@plitzi/sdk-schema/helpers/elementTree';

import { empty, fail, findPageByRef, indexRemovePage } from '../../../../helpers';
import { pageUri, pagesUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deletePageOp = z
  .object({ type: z.literal('deletePage'), ref: z.string().describe('The page, by name') })
  .describe('Delete a page and every element on it.');

export type DeletePage = z.infer<typeof deletePageOp>;

export const deletePage = (space: Space, env: Env, op: DeletePage): OpResult => {
  const page = findPageByRef(space.schema, op.ref);
  if (!page) {
    return fail('ref', `Page "${op.ref}" not found`, 'Read the pages resource for valid refs');
  }

  const removedIds = descendants(space.schema.flat, page.id);
  const removed = removedIds.map(id => space.schema.flat[id]);
  for (const id of [...removedIds, page.id]) {
    Reflect.deleteProperty(space.schema.flat, id);
  }

  space.schema.pages = space.schema.pages.filter(id => id !== page.id);
  indexRemovePage(space.schema, page, removed);

  return { ...empty(), deleted: 1, staleResources: [pageUri(env, op.ref), pagesUri(env)] };
};
