import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { authorSnippet } from '@plitzi/sdk-authoring';
import { documentIds, FlatMap } from '@plitzi/sdk-schema';

import { empty, fail, findRootByRef, indexAddElement, resolveRef } from '../../../../helpers';
import { defsUri, MODES } from '../../style/write';
import { position } from '../shared';
import { DROP_POSITION, pageUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { ElementSpec, SnippetSpec } from '@plitzi/sdk-authoring';

export const addSpecOp = z
  .object({
    type: z.literal('addSpec'),
    pageRef: z.string().describe('The page or layout'),
    parentRef: z.string().optional().describe('The element it goes relative to; the page when left out'),
    position: position.optional(),
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
  .describe("An element tree in the authoring skill's vocabulary, with the classes it names; every id must be new");

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

  const anchor = op.parentRef === undefined ? page : resolveRef(space.schema, page, op.parentRef);
  if (!anchor) {
    return fail(
      'missing',
      'parentRef',
      `"${op.parentRef ?? ''}" is no element of "${op.pageRef}"`,
      'Use an existing ref'
    );
  }

  const authoring = authorSpec(op);
  if ('error' in authoring) {
    return fail('bad-value', 'spec', authoring.error, AUTHORING_HINT);
  }

  const { authored } = authoring;
  const fragment = authored.snippet.schema.flat;
  const rootId = authored.snippet.definition.baseElementId;
  const taken = documentIds(space.schema);
  const clashing = Object.keys(fragment).filter(id => taken.has(id));
  if (clashing.length > 0) {
    return fail(
      'exists',
      'spec',
      `The space already has ${clashing.map(id => `"${id}"`).join(', ')}`,
      'Name them anew, or edit the ones there with patchElement'
    );
  }

  const root = fragment[rootId];
  const drop = DROP_POSITION[op.position ?? 'inside'];
  for (const element of Object.values(fragment)) {
    element.definition.rootId = page.id;
  }

  if (!new FlatMap({ flat: space.schema.flat }).addElement(root, anchor.id, drop)) {
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
    elementRefs: Object.keys(fragment),
    staleResources: [pageUri(env, op.pageRef), ...(declared.length > 0 ? [defsUri(env)] : [])]
  };
};
