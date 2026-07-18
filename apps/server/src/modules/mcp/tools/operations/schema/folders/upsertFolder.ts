import { z } from 'zod';

import { empty, fail, findFolderByRef, pageFoldersOf, slugify, sortFolders } from '../../../../helpers';
import { folderUri, foldersUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { PageFolder } from '@plitzi/sdk-shared';

export const upsertFolderOp = z
  .object({
    type: z.literal('upsertFolder'),
    ref: z.string().describe('Folder ref: an existing folder id/name/slug to update, or a new id you choose'),
    name: z.string().optional(),
    slug: z.string().optional(),
    parentId: z.string().nullable().optional().describe('Ref of the parent folder for nesting; null keeps it at root')
  })
  .describe('Create a sidebar page-folder, or update it when ref already exists. Nest it under another via parentId.');

export type UpsertFolder = z.infer<typeof upsertFolderOp>;

export const upsertFolder = (space: Space, env: Env, op: UpsertFolder): OpResult => {
  const folders = pageFoldersOf(space.schema);

  let parentId: string | undefined;
  if (op.parentId !== undefined && op.parentId !== null) {
    const parent = findFolderByRef(space.schema, op.parentId);
    if (!parent) {
      return fail('parentId', `Parent folder "${op.parentId}" not found`, 'Create it with upsertFolder first');
    }

    parentId = parent.id;
  }

  const existing = findFolderByRef(space.schema, op.ref);
  if (existing) {
    if (op.name !== undefined) {
      existing.name = op.name;
    }

    if (op.slug !== undefined) {
      existing.slug = op.slug;
    }

    if (op.parentId === null) {
      Reflect.deleteProperty(existing, 'parentId');
    } else if (op.parentId !== undefined) {
      existing.parentId = parentId;
    }

    space.schema.pageFolders = sortFolders(folders);

    return { ...empty(), updated: 1, staleResources: [folderUri(env, existing.id), foldersUri(env)] };
  }

  const folder: PageFolder = { id: op.ref, name: op.name ?? op.ref, slug: op.slug ?? slugify(op.ref) };
  if (parentId !== undefined) {
    folder.parentId = parentId;
  }

  folders.push(folder);
  space.schema.pageFolders = sortFolders(folders);

  return { ...empty(), created: 1, staleResources: [folderUri(env, folder.id), foldersUri(env)] };
};
