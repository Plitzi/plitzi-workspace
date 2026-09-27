import { z } from 'zod';

import { empty, fail, findRootByRef, resolveRef } from '../../../../helpers';
import { elementInput, position } from '../shared';
import { DROP_POSITION, collectInputRefs, createElement, guardNewRef, pageUri, writeInitialState } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { DropPosition } from '@plitzi/sdk-shared';

export const upsertElementOp = z
  .object({
    type: z.literal('upsertElement'),
    pageRef: z.string().describe('The page, by name'),
    element: elementInput,
    parentRef: z.string().optional().describe('Anchor ref/id; defaults to page root'),
    position: position.optional()
  })
  .describe(
    'Add an element to a page, or fully update it when element.ref already exists (props and style are REPLACED, ' +
      'not merged). To change only some fields of an existing element, use patchElement instead.'
  );

export type UpsertElement = z.infer<typeof upsertElementOp>;

export const upsertElement = (space: Space, env: Env, op: UpsertElement): OpResult => {
  const page = findRootByRef(space.schema, op.pageRef);
  if (!page) {
    return fail(
      'pageRef',
      `Page or layout "${op.pageRef}" not found`,
      'Read plitzi://schema/' + env + '/pages for valid refs'
    );
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

    if (op.element.initialState !== undefined) {
      writeInitialState(existing, op.element.initialState, false);
    }

    if (op.element.runtime !== undefined) {
      existing.definition.runtime = op.element.runtime;
    }

    return { ...empty(), updated: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.element.ref] };
  }

  // Creating: every name in the input tree becomes a new element's id, so each must pass the charset/uniqueness
  // guard before anything is written (duplicates *within* the batch are already rejected by the validator).
  for (const ref of collectInputRefs(op.element)) {
    const guard = guardNewRef(space, ref, 'element.ref');
    if (guard) {
      return guard;
    }
  }

  let anchorId = page.id;
  let drop: DropPosition = 'inside';
  if (op.parentRef) {
    const anchor = resolveRef(space.schema, page, op.parentRef);
    if (!anchor) {
      return fail('parentRef', `Parent "${op.parentRef}" not found in page "${op.pageRef}"`, 'Use an existing ref');
    }

    anchorId = anchor.id;
    drop = DROP_POSITION[op.position ?? 'inside'];
  }

  if (!createElement(space, page, op.element, anchorId, drop)) {
    return fail(
      'parentRef',
      `"${op.element.ref}" cannot be placed ${op.position ?? 'inside'} "${op.parentRef ?? op.pageRef}"`,
      'An element goes inside an element that holds children, or before/after one that has a parent — a page has no siblings.'
    );
  }

  return { ...empty(), created: 1, staleResources: [pageUri(env, op.pageRef)], elementRefs: [op.element.ref] };
};
