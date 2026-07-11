import { z } from 'zod';

import { elementInput, position } from './shared';
import { createElement, pageUri } from './write';
import { empty, fail, findPageByRef, resolveRef } from '../../../helpers';

import type { Space } from '../../../helpers';
import type { OpResult } from '../../../helpers';
import type { Env } from '../../../types';

export const upsertElementOp = z.object({
  type: z.literal('upsertElement'),
  pageRef: z.string().describe('Page ref or id'),
  element: elementInput,
  parentRef: z.string().optional().describe('Anchor ref/id; defaults to page root'),
  position: position.optional()
});

export type UpsertElement = z.infer<typeof upsertElementOp>;

export const upsertElement = (space: Space, env: Env, op: UpsertElement): OpResult => {
  const page = findPageByRef(space.schema, op.pageRef);
  if (!page) {
    return fail('pageRef', `Page "${op.pageRef}" not found`, 'Read plitzi://schema/' + env + '/pages for valid refs');
  }

  const existing = resolveRef(space.schema, page, op.element.ref);
  if (existing && existing.id !== page.id) {
    if (op.element.label !== undefined) {
      existing.definition.label = op.element.label;
    }

    if (op.element.props !== undefined || op.element.subType !== undefined) {
      const subType = op.element.subType ?? existing.attributes.subType;
      existing.attributes = subType === undefined ? { ...op.element.props } : { subType, ...op.element.props };
    }

    if (op.element.style !== undefined) {
      const selectors: Record<string, string> = { base: (op.element.style.base ?? []).join(' ') };
      for (const [slot, classes] of Object.entries(op.element.style.slots ?? {})) {
        selectors[slot] = classes.join(' ');
      }

      existing.definition.styleSelectors = selectors as { base: string; [selector: string]: string };
    }

    return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.element.ref] };
  }

  let parent = page;
  let index: number | undefined;
  if (op.parentRef) {
    const anchor = resolveRef(space.schema, page, op.parentRef);
    if (!anchor) {
      return fail('parentRef', `Parent "${op.parentRef}" not found in page "${op.pageRef}"`, 'Use an existing ref');
    }

    if (op.position === 'before' || op.position === 'after') {
      parent = anchor.definition.parentId ? space.schema.flat[anchor.definition.parentId] : page;
      const items = parent.definition.items ?? [];
      const at = items.indexOf(anchor.id);
      index = at < 0 ? undefined : op.position === 'after' ? at + 1 : at;
    } else {
      parent = anchor;
    }
  }

  createElement(space, page, op.element, parent, index);

  return { ...empty(), created: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.element.ref] };
};
