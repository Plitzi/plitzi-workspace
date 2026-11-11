import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { authorSnippet } from '@plitzi/sdk-authoring';
import { descendants, documentIds, FlatMap } from '@plitzi/sdk-schema';

import { empty, fail, findRootByRef, indexAddElement, indexRemoveElements, resolveRef } from '../../../../helpers';
import { defsUri, MODES } from '../../style/write';
import { position } from '../shared';
import { DROP_POSITION, pageUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { ElementSpec, SnippetSpec } from '@plitzi/sdk-authoring';
import type { DropPosition, Element } from '@plitzi/sdk-shared';

export const addSpecOp = z
  .object({
    type: z.literal('addSpec'),
    pageRef: z.string().describe('The page or layout'),
    parentRef: z.string().optional().describe('The element it goes relative to; the page when left out'),
    position: position.optional(),
    replaces: z
      .string()
      .optional()
      .describe('An element it takes the place of, with all under it: their ids are free for the spec to name again'),
    spec: z
      .record(z.string(), z.unknown())
      .describe(
        'An element as authoring writes one, as JSON (what `container({ … })` returns): `type`, `id`, `attributes`, ' +
          '`class`, `css`, `bind`, `flows`, `visible`, `children`'
      ),
    classes: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .optional()
      .describe('The classes it names, as `styles(name, { … })` takes them')
  })
  .describe(
    "An element tree in the authoring skill's vocabulary, with the classes it names; every id new, or one `replaces` frees"
  );

export type AddSpec = z.infer<typeof addSpecOp>;

const AUTHORING_HINT =
  'Write it as the authoring skill does (its CHEATSHEET); plitzi_describe_operation { type: "addSpec" } gives the fields';

/**
 * The spec authored as a snippet: authoring reads every field it is handed and refuses what it cannot, in its words —
 * the shapes are its own, checked there, never here. A key of its own per call: an element the spec does not name is
 * given an id from it, new to the space.
 */
export const authorSpec = (
  op: Pick<AddSpec, 'spec' | 'classes'>
): { authored: ReturnType<typeof authorSnippet> } | { error: string } => {
  try {
    const spec: SnippetSpec = {
      name: 'MCP',
      description: 'Written by an agent',
      key: `mcp-${randomUUID().slice(0, 8)}`,
      // The JSON an ElementSpec is, which authoring checks whole: no other reading of it is made here.
      root: op.spec as unknown as ElementSpec,
      ...(op.classes ? { classes: op.classes } : {})
    };

    return { authored: authorSnippet(spec) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

type Placement = { anchor: string; drop: DropPosition; replaced: Element[] } | { error: OpResult };

/**
 * Where the tree goes: relative to `parentRef`, or in the place of what `replaces` names — after the sibling before it,
 * before the one after it, or inside its parent when it had none — with that element and all under it, which go.
 */
const placementOf = (space: Space, page: Element, op: AddSpec): Placement => {
  if (op.replaces === undefined) {
    const anchor = op.parentRef === undefined ? page : resolveRef(space.schema, page, op.parentRef);
    if (!anchor) {
      return {
        error: fail(
          'missing',
          'parentRef',
          `"${op.parentRef ?? ''}" is no element of "${op.pageRef}"`,
          'Use an existing ref'
        )
      };
    }

    return { anchor: anchor.id, drop: DROP_POSITION[op.position ?? 'inside'], replaced: [] };
  }

  if (op.parentRef !== undefined || op.position !== undefined) {
    return {
      error: fail(
        'bad-value',
        'replaces',
        'A tree that replaces an element takes its place: `parentRef` and `position` would name another',
        'Leave them out, or leave out `replaces` to add the tree beside it'
      )
    };
  }

  const old = resolveRef(space.schema, page, op.replaces);
  const parent = old?.definition.parentId === undefined ? undefined : space.schema.flat[old.definition.parentId];
  if (!old || old.id === page.id || !parent) {
    return {
      error: fail(
        'missing',
        'replaces',
        `"${op.replaces}" is no element of "${op.pageRef}"`,
        'Read the page resource for valid refs'
      )
    };
  }

  const replaced = [old, ...descendants(space.schema.flat, old.id).map(id => space.schema.flat[id])];
  const siblings = parent.definition.items ?? [];
  const at = siblings.indexOf(old.id);
  if (at > 0) {
    return { anchor: siblings[at - 1], drop: 'bottom', replaced };
  }

  if (at >= 0 && at < siblings.length - 1) {
    return { anchor: siblings[at + 1], drop: 'top', replaced };
  }

  return { anchor: parent.id, drop: 'inside', replaced };
};

export const addSpec = (space: Space, env: Env, op: AddSpec): OpResult => {
  const page = findRootByRef(space.schema, op.pageRef);
  if (!page) {
    return fail(
      'missing',
      'pageRef',
      `Page or layout "${op.pageRef}" not found`,
      'Read the pages resource for valid refs'
    );
  }

  const target = placementOf(space, page, op);
  if ('error' in target) {
    return target.error;
  }

  const authoring = authorSpec(op);
  if ('error' in authoring) {
    return fail('bad-value', 'spec', authoring.error, AUTHORING_HINT);
  }

  const { authored } = authoring;
  const fragment = authored.snippet.schema.flat;
  const rootId = authored.snippet.definition.baseElementId;
  const taken = documentIds(space.schema);
  const freed = new Set(target.replaced.map(element => element.id));
  const clashing = Object.keys(fragment).filter(id => taken.has(id) && !freed.has(id));
  if (clashing.length > 0) {
    return fail(
      'exists',
      'spec',
      `The space already has ${clashing.map(id => `"${id}"`).join(', ')}`,
      'Name them anew, or edit the ones there with patchElement'
    );
  }

  const root = fragment[rootId];
  for (const element of Object.values(fragment)) {
    element.definition.rootId = page.id;
  }

  const flatMap = new FlatMap({ flat: space.schema.flat });
  if (target.replaced.length > 0) {
    flatMap.removeElement(target.replaced[0].id);
    indexRemoveElements(space.schema, target.replaced);
  }

  if (!flatMap.addElement(root, target.anchor, target.drop)) {
    return fail(
      'bad-value',
      'parentRef',
      `It cannot go ${op.position ?? 'inside'} "${op.parentRef ?? op.pageRef}"`,
      'An element goes inside one that holds children, or before/after one that has a parent'
    );
  }

  indexAddElement(space.schema, root, page.id);
  for (const element of Object.values(fragment)) {
    if (element.id !== rootId) {
      space.schema.flat[element.id] = element;
      indexAddElement(space.schema, element, page.id);
    }
  }

  // The classes the spec declared, written as an upsert of each: a class of the same name is replaced.
  const declared = Object.keys(op.classes ?? {});
  for (const mode of MODES) {
    const rules = authored.snippet.style.platform[mode];
    for (const name of declared) {
      if (Object.hasOwn(rules, name)) {
        space.style.platform[mode][name] = rules[name];
      }
    }
  }

  return {
    ...empty(),
    created: Object.keys(fragment).length,
    ...(target.replaced.length > 0 ? { deleted: 1 } : {}),
    elementRefs: Object.keys(fragment),
    staleResources: [pageUri(env, op.pageRef), ...(declared.length > 0 ? [defsUri(env)] : [])]
  };
};
