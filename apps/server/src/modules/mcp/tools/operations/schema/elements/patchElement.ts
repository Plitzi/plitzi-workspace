import { z } from 'zod';

import { repointIdRefs } from '@plitzi/sdk-schema/helpers/idRef';

import { empty, fail, findPageByRef, resolveRef } from '../../../../helpers';
import { initialStateInput, styleRefs } from '../shared';
import { guardNewRef, pageUri, writeInitialState } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const patchElementOp = z
  .object({
    type: z.literal('patchElement'),
    pageRef: z.string().describe('Page ref or id'),
    ref: z.string().describe('Existing element ref or id'),
    idRef: z
      .string()
      .optional()
      .describe(
        'Assign or rename the idRef of this element ([A-Za-z0-9_-], starting with a letter, unique in the space). ' +
          'Give an element one to ' +
          'make it bindable: without an idRef it publishes no data source. Renaming one moves its source name ' +
          'with it — every binding and interaction across the space that targeted the old name is repointed for ' +
          'you, so the wiring survives the rename.'
      ),
    label: z.string().optional(),
    subType: z.string().optional(),
    props: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Merged onto existing props: listed keys change, null unsets a key, others are preserved'),
    style: styleRefs.optional().describe('Merged onto existing style: base replaces base, listed slots replace slots'),
    initialState: initialStateInput
      .optional()
      .describe('Merged onto existing initialState: styleVariant overlays per class/selector, visibility overrides')
  })
  .describe(
    'Partially update an EXISTING element: only the fields you pass change (props/style/initialState are merged, ' +
      'not replaced). Never creates — fails if ref does not resolve. Use upsertElement to create or fully replace.'
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

  // Re-uses the create-time guard: an idRef assigned here is the same wiring key, so it faces the same charset and
  // space-wide uniqueness rules. Setting an element's current idRef to itself is a no-op, not a conflict.
  if (op.idRef !== undefined && op.idRef !== el.idRef) {
    const guard = guardNewRef(space, op.idRef, 'idRef');
    if (guard) {
      return guard;
    }

    // A rename moves the wiring key, so every binding source and interaction target written against the old name
    // has to move with it — across the whole space, since an element on another page may bind to this one. An
    // element that had no idRef has nothing pointing at it yet, so only a true rename repoints.
    const previous = el.idRef;
    el.idRef = op.idRef;
    if (previous) {
      repointIdRefs(space.schema.flat, { [previous]: op.idRef });
    }
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

  if (op.initialState !== undefined) {
    writeInitialState(el, op.initialState, true);
  }

  return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
