import { z } from 'zod';

import { empty, fail, findRootByRef, indexInvalidateDetails, resolveRef } from '../../../../helpers';
import { position } from '../shared';
import { pageUri, placeChild, removeFromParent } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const moveElementOp = z
  .object({
    type: z.literal('moveElement'),
    pageRef: z.string().describe('The page, by name'),
    ref: z.string().describe('The element to move, by name'),
    toParentRef: z.string().describe('The anchor it moves relative to, by name (see position)'),
    position
  })
  .describe('Move an existing element to a new parent, or reorder it — its placement is set by position.');

export type MoveElement = z.infer<typeof moveElementOp>;

export const moveElement = (space: Space, env: Env, op: MoveElement): OpResult => {
  const page = findRootByRef(space.schema, op.pageRef);
  if (!page) {
    return fail('pageRef', `Page or layout "${op.pageRef}" not found`, 'Read the pages resource for valid refs');
  }

  const el = resolveRef(space.schema, page, op.ref);
  const anchor = resolveRef(space.schema, page, op.toParentRef);
  if (!el || el.id === page.id) {
    return fail('ref', `Element "${op.ref}" not found`, 'Read the page resource for valid refs');
  }

  if (!anchor) {
    return fail('toParentRef', `Target "${op.toParentRef}" not found`, 'Read the page resource for valid refs');
  }

  removeFromParent(space, el);
  let parent = anchor;
  let index: number | undefined;
  if (op.position === 'before' || op.position === 'after') {
    parent = anchor.definition.parentId ? (space.schema.flat[anchor.definition.parentId] ?? page) : page;
    const items = parent.definition.items ?? [];
    const at = items.indexOf(anchor.id);
    index = at < 0 ? undefined : op.position === 'after' ? at + 1 : at;
  }

  el.definition.parentId = parent.id;
  placeChild(parent, el.id, index);
  // The move stays within the page (both refs resolved inside it), so the ref/page maps are unchanged; only the
  // moved element's parentRef and the two parents' childRefs did, so just drop the affected memoized detail.
  indexInvalidateDetails(space.schema);

  return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
