import { z } from 'zod';

import { flagGateOf } from '@plitzi/sdk-authoring';
import { repointIds } from '@plitzi/sdk-schema/helpers/elementId';
import { isMotion } from '@plitzi/sdk-shared/schema/motion';

import { empty, fail, findRootByRef, invalidateIndex, resolveRef } from '../../../../helpers';
import {
  elementAnchor,
  elementFlag,
  elementMotion,
  elementQuiet,
  elementRuntime,
  initialStateInput,
  styleRefs
} from '../shared';
import { guardNewRef, pageUri, writeInitialState } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';

export const patchElementOp = z
  .object({
    type: z.literal('patchElement'),
    pageRef: z.string().describe('The page, by name'),
    ref: z.string().describe('An existing element, by name'),
    rename: z
      .string()
      .optional()
      .describe(
        'A new name for this element ([A-Za-z0-9_-], starting with a letter, unique in the space). The name IS the ' +
          'id: the key everything addresses it by, the source name it publishes under, the target an interaction ' +
          'fires on. A rename moves all of that with it — every binding and interaction that named the old one is ' +
          'repointed for you.'
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
      .describe('Merged onto existing initialState: styleVariant overlays per class/selector, visibility overrides'),
    runtime: elementRuntime.optional(),
    flag: elementFlag.nullable().optional(),
    anchor: elementAnchor.nullable().optional().describe('null removes it'),
    motion: elementMotion.nullable().optional().describe('null removes it'),
    quiet: elementQuiet.nullable().optional()
  })
  .describe(
    'Partially update an EXISTING element: only the fields you pass change (props/style/initialState are merged, ' +
      'not replaced). Never creates — fails if ref does not resolve. Use upsertElement to create or fully replace.'
  );

export type PatchElement = z.infer<typeof patchElementOp>;

export const patchElement = (space: Space, env: Env, op: PatchElement): OpResult => {
  const page = findRootByRef(space.schema, op.pageRef);
  if (!page) {
    return fail(
      'pageRef',
      `Page or layout "${op.pageRef}" not found`,
      'Read plitzi://schema/' + env + '/pages for valid refs'
    );
  }

  const el = resolveRef(space.schema, page, op.ref);
  if (!el || el.id === page.id) {
    return fail(
      'ref',
      `Element "${op.ref}" not found in page "${op.pageRef}"`,
      'patchElement only updates an existing element; use upsertElement to create one'
    );
  }

  // Re-uses the create-time guard: a name assigned here is the same key an element was created under, so it faces
  // the same charset and space-wide uniqueness rules. Renaming an element to its own name is a no-op.
  if (op.rename !== undefined && op.rename !== el.id) {
    const guard = guardNewRef(space, op.rename, 'rename');
    if (guard) {
      return guard;
    }

    // A rename moves the ONE key everything points at, so the `flat` key, the parent's `items`, every binding
    // source and every interaction target written against the old name move with it — across the whole space,
    // since an element on another page may bind to this one.
    repointIds(space.schema.flat, { [el.id]: op.rename }, space.schema.pages);
    invalidateIndex(space.schema);
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

  if (op.runtime !== undefined) {
    el.definition.runtime = op.runtime;
  }

  if (op.flag === null) {
    Reflect.deleteProperty(el.definition, 'flag');
  } else if (op.flag !== undefined) {
    el.definition.flag = flagGateOf(op.flag, `Element "${op.ref}"`);
  }

  if (op.anchor === null) {
    Reflect.deleteProperty(el.definition, 'anchor');
  } else if (op.anchor !== undefined) {
    el.definition.anchor = op.anchor;
  }

  if (op.motion === null) {
    Reflect.deleteProperty(el.definition, 'motion');
  } else if (isMotion(op.motion)) {
    el.definition.motion = op.motion;
  }

  if (op.quiet === null) {
    Reflect.deleteProperty(el.definition, 'quiet');
  } else if (op.quiet !== undefined) {
    el.definition.quiet = op.quiet;
  }

  return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.ref] };
};
