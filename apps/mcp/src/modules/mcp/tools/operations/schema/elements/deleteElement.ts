import { z } from 'zod';

import { descendants } from '@plitzi/sdk-schema/helpers/elementTree';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';

import { empty, fail, findRootByRef, indexRemoveElements, resolveRef } from '../../../../helpers';
import { pageUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deleteElementOp = z
  .object({
    type: z.literal('deleteElement'),
    pageRef: z.string().describe('The page, by name'),
    ref: z.string().describe('The element to delete, by name')
  })
  .describe('Delete an element and all of its descendants from a page.');

export type DeleteElement = z.infer<typeof deleteElementOp>;

export const deleteElement = (space: Space, env: Env, op: DeleteElement): OpResult => {
  const page = findRootByRef(space.schema, op.pageRef);
  if (!page) {
    return fail('pageRef', `Page or layout "${op.pageRef}" not found`, 'Read the pages resource for valid refs');
  }

  const el = resolveRef(space.schema, page, op.ref);
  if (!el || el.id === page.id) {
    return fail(
      'ref',
      `Element "${op.ref}" not found in page "${op.pageRef}"`,
      'Read the page resource for valid refs'
    );
  }

  const removed = [el.id, ...descendants(space.schema.flat, el.id)].map(id => space.schema.flat[id]);
  new FlatMap({ flat: space.schema.flat }).removeElement(el.id);
  indexRemoveElements(space.schema, removed);

  return { ...empty(), deleted: 1, staleResources: [pageUri(env, op.pageRef)] };
};
