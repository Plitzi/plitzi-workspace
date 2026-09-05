import { z } from 'zod';

import { empty, findLayoutByRef, indexAddLayout } from '../../../../helpers';
import { guardNewRef, layoutsUri, pageUri } from '../write';

import type { OpResult, Space } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { Element } from '@plitzi/sdk-shared';

export const upsertLayoutOp = z
  .object({
    type: z.literal('upsertLayout'),
    ref: z.string().describe('Layout id to update, or a new id to create one. Pages reference it by this name.'),
    label: z.string().optional(),
    subType: z
      .enum(['div', 'header', 'footer', 'nav', 'main', 'section', 'article', 'aside', 'address', 'figure'])
      .optional()
  })
  .describe(
    'Create/update a shared layout shell: the chrome (header, sidebar, footer) several pages render INSIDE. It is ' +
      'a root like a page — fill it with upsertElement using pageRef: "<this ref>", then attach pages with ' +
      'upsertPage { layout, layoutContainer }. See "Shared layouts" in plitzi://guide.'
  );

export type UpsertLayout = z.infer<typeof upsertLayoutOp>;

export const upsertLayout = (space: Space, env: Env, op: UpsertLayout): OpResult => {
  const existing = findLayoutByRef(space.schema, op.ref);
  if (existing) {
    if (op.label !== undefined) {
      existing.definition.label = op.label;
    }

    if (op.subType !== undefined) {
      existing.attributes = { ...existing.attributes, subType: op.subType };
    }

    return { ...empty(), updated: 1, staleResources: [pageUri(env, op.ref), layoutsUri(env)] };
  }

  const guard = guardNewRef(space, op.ref, 'ref');
  if (guard) {
    return guard;
  }

  const id = op.ref;
  const layout: Element = {
    id,
    attributes: { subType: op.subType ?? 'div' },
    definition: {
      // Its own root, and no parent: that is what makes it a shell a page can name rather than an element a page
      // contains. A layoutContainer WITH a parent is an ordinary element of whatever tree owns it.
      rootId: id,
      label: op.label ?? op.ref,
      type: 'layoutContainer',
      items: [],
      styleSelectors: { base: '' }
    }
  };
  space.schema.flat[id] = layout;
  indexAddLayout(space.schema, layout);

  return { ...empty(), created: 1, staleResources: [pageUri(env, op.ref), layoutsUri(env)] };
};
