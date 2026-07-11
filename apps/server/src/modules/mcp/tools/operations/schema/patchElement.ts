import { z } from 'zod';

import { styleRefs } from './shared';
import { pageUri } from './write';
import { empty, fail, findPageByRef, resolveRef } from '../../../helpers';

import type { Space } from '../../../helpers';
import type { OpResult } from '../../../helpers';
import type { Env } from '../../../types';

export const patchElementOp = z
  .object({
    type: z.literal('patchElement'),
    pageRef: z.string().describe('Page ref or id'),
    ref: z.string().describe('Existing element ref or id'),
    label: z.string().optional(),
    subType: z.string().optional(),
    props: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Merged onto existing props: listed keys change, null unsets a key, others are preserved'),
    style: styleRefs.optional().describe('Merged onto existing style: base replaces base, listed slots replace slots')
  })
  .describe(
    'Partially update an EXISTING element: only the fields you pass change (props/style are merged, not replaced). ' +
      'Never creates — fails if ref does not resolve. Use upsertElement to create or fully replace.'
  );

export type PatchElement = z.infer<typeof patchElementOp>;

export const patchElement = (space: Space, env: Env, op: PatchElement): OpResult => {
  const page = findPageByRef(space.schema, op.pageRef);
  if (!page) {
    return fail('pageRef', `Page "${op.pageRef}" not found`, 'Read plitzi://schema/' + env + '/pages for valid refs');
  }

  const el = resolveRef(space.schema, page, op.ref);
  if (!el || el.id === page.id) {
    return fail(
      'ref',
      `Element "${op.ref}" not found in page "${op.pageRef}"`,
      'patchElement only updates an existing element; use upsertElement to create one'
    );
  }

  if (op.label !== undefined) {
    el.definition.label = op.label;
  }

  if (op.subType !== undefined) {
    el.attributes = { ...el.attributes, subType: op.subType };
  }

  if (op.props !== undefined) {
    const merged: Record<string, unknown> = { ...el.attributes };
    for (const [key, value] of Object.entries(op.props)) {
      if (value === null) {
        Reflect.deleteProperty(merged, key);
      } else {
        merged[key] = value;
      }
    }

    el.attributes = merged;
  }

  if (op.style !== undefined) {
    const selectors: Record<string, string> = { ...el.definition.styleSelectors };
    if (op.style.base !== undefined) {
      selectors.base = op.style.base.join(' ');
    }

    for (const [slot, classes] of Object.entries(op.style.slots ?? {})) {
      selectors[slot] = classes.join(' ');
    }

    el.definition.styleSelectors = selectors as { base: string; [selector: string]: string };
  }

  return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
