import { z } from 'zod';

import { descendantIds, empty, fail, findPageByRef, indexRemoveElements, resolveRef } from '../../../../helpers';
import { pageUri, removeFromParent } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deleteElementOp = z
  .object({
    type: z.literal('deleteElement'),
    pageRef: z.string().describe('Page ref or id'),
    ref: z.string().describe('Ref or id of the element to delete')
  })
  .describe('Delete an element and all of its descendants from a page.');

export type DeleteElement = z.infer<typeof deleteElementOp>;

export const deleteElement = (space: Space, env: Env, op: DeleteElement): OpResult => {
  const page = findPageByRef(space.schema, op.pageRef);
  if (!page) {
    return fail('pageRef', `Page "${op.pageRef}" not found`, 'Read the pages resource for valid refs');
  }

  const el = resolveRef(space.schema, page, op.ref);
  if (!el || el.id === page.id) {
    return fail(
      'ref',
      `Element "${op.ref}" not found in page "${op.pageRef}"`,
      'Read the page resource for valid refs'
    );
  }

  const ids = [...descendantIds(space.schema, el.id), el.id];
  const removed = ids.map(id => space.schema.flat[id]);
  for (const id of ids) {
    Reflect.deleteProperty(space.schema.flat, id);
  }

  removeFromParent(space, el);
  indexRemoveElements(space.schema, removed);

  return { ...empty(), deleted: 1, staleResources: [pageUri(env, op.pageRef)] };
};
