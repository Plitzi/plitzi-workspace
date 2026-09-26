import { z } from 'zod';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';

import { empty, fail, findRootByRef, indexInvalidateDetails, resolveRef } from '../../../../helpers';
import { position } from '../shared';
import { DROP_POSITION, pageUri } from '../write';

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

  // `from` is where the element sits now; the move itself — and its refusal to put a subtree inside itself — is the
  // tree operation every writer shares.
  const moved = new FlatMap({ flat: space.schema.flat }).moveElement(
    el.definition.parentId ?? page.id,
    anchor.id,
    el.id,
    DROP_POSITION[op.position]
  );
  if (!moved) {
    return fail(
      'toParentRef',
      `"${op.ref}" cannot move ${op.position} "${op.toParentRef}"`,
      'An element cannot move inside itself or one of its own descendants, and before/after needs an anchor that has a parent.'
    );
  }

  // The move stays within the page (both refs resolved inside it), so the ref/page maps are unchanged; only the
  // moved element's parentRef and the two parents' childRefs did, so just drop the affected memoized detail.
  indexInvalidateDetails(space.schema);

  return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
