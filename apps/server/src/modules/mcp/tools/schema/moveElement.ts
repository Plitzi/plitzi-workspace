import { z } from 'zod';

import { position } from './shared';
import { pageUri, placeChild, removeFromParent } from './write';
import { empty, fail, findPageByRef, resolveRef } from '../../helpers';

import type { Space } from '../../helpers';
import type { OpResult } from '../../helpers';
import type { Env } from '../../types';

export const moveElementOp = z.object({
  type: z.literal('moveElement'),
  pageRef: z.string(),
  ref: z.string(),
  toParentRef: z.string(),
  position
});

export type MoveElement = z.infer<typeof moveElementOp>;

export const moveElement = (space: Space, env: Env, op: MoveElement): OpResult => {
  const page = findPageByRef(space.schema, op.pageRef);
  if (!page) {
    return fail('pageRef', `Page "${op.pageRef}" not found`, 'Read the pages resource for valid refs');
  }

  const el = resolveRef(space.schema, page, op.ref);
  const anchor = resolveRef(space.schema, page, op.toParentRef);
  if (!el || el.id === page.id) {
    return fail('ref', `Element "${op.ref}" not found`, 'Read the page resource for valid refs');
  }

  if (!anchor) {
    return fail('toParentRef', `Target "${op.toParentRef}" not found`, 'Read the page resource for valid refs');
  }

  removeFromParent(space, el.id);
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

  return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
