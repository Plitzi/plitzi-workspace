import { z } from 'zod';

import { empty, fail, findFolderByRef, findPageByRef, generateObjectId } from '../../../../helpers';
import { guardNewRef, pageUri, pagesUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { Element } from '@plitzi/sdk-shared';

export const upsertPageOp = z
  .object({
    type: z.literal('upsertPage'),
    ref: z
      .string()
      .describe(
        'Page id/slug to update, or a new id you choose to create one. On a new page it is stored as its idRef: ' +
          'letters, numbers and hyphens only ("pricing"), unique across the space.'
      ),
    label: z.string().optional(),
    slug: z.string().optional(),
    folder: z
      .string()
      .nullable()
      .optional()
      .describe('Ref of an existing folder to place this page in; "" or null moves it to the root. Unknown → error'),
    default: z.boolean().optional(),
    enabled: z
      .boolean()
      .optional()
      .describe(
        'false disables the page in the published SDK runtime (not routable/accessible to end users); it stays ' +
          'editable here. Defaults to true'
      )
  })
  .describe('Create a page, or update it when ref already exists (only the fields you pass change).');

export type UpsertPage = z.infer<typeof upsertPageOp>;

export const upsertPage = (space: Space, env: Env, op: UpsertPage): OpResult => {
  // The stored `folder` is always either '' (root) or an existing folder id — never a dangling ref. undefined =
  // leave as-is; null or '' = move to root; any other ref must resolve to an existing folder or the op fails.
  let folderValue: string | undefined;
  if (op.folder !== undefined) {
    if (op.folder === null || op.folder === '') {
      folderValue = '';
    } else {
      const resolved = findFolderByRef(space.schema, op.folder);
      if (!resolved) {
        return fail(
          'folder',
          `Folder "${op.folder}" not found`,
          'Create it with upsertFolder, or read plitzi://folders'
        );
      }

      folderValue = resolved.id;
    }
  }

  const existing = findPageByRef(space.schema, op.ref);
  if (existing) {
    existing.attributes = {
      ...existing.attributes,
      ...(op.slug !== undefined ? { slug: op.slug } : {}),
      ...(op.label !== undefined ? { name: op.label } : {}),
      ...(op.default !== undefined ? { default: op.default } : {}),
      ...(op.enabled !== undefined ? { enabled: op.enabled } : {}),
      ...(folderValue !== undefined ? { folder: folderValue } : {})
    };

    return { ...empty(), updated: 1, staleResources: [pageUri(env, op.ref), pagesUri(env)] };
  }

  // Creating: the ref becomes this page's idRef, so it must pass the same charset/uniqueness guard as any element.
  const guard = guardNewRef(space, op.ref, 'ref');
  if (guard) {
    return guard;
  }

  const id = generateObjectId();
  const attributes: Element['attributes'] = {
    slug: op.slug ?? '',
    name: op.label ?? op.ref,
    default: op.default ?? false,
    enabled: op.enabled ?? true,
    folder: folderValue ?? ''
  };
  space.schema.flat[id] = {
    id,
    idRef: op.ref,
    attributes,
    definition: {
      rootId: id,
      label: op.label ?? op.ref,
      type: 'page',
      items: [],
      styleSelectors: { base: '' }
    }
  };
  space.schema.pages.push(id);

  return { ...empty(), created: 1, staleResources: [pageUri(env, op.ref), pagesUri(env)] };
};
