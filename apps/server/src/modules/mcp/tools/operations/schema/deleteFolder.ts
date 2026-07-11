import { z } from 'zod';

import { folderUri, foldersUri, pagesUri } from './write';
import { empty, fail, findFolderByRef, isPageElement, pageFoldersOf, sortFolders } from '../../../helpers';

import type { Space } from '../../../helpers';
import type { OpResult } from '../../../helpers';
import type { Env } from '../../../types';

export const deleteFolderOp = z
  .object({ type: z.literal('deleteFolder'), ref: z.string() })
  .describe('Delete a folder; its child folders and pages move up to its parent (or the root)');

export type DeleteFolder = z.infer<typeof deleteFolderOp>;

export const deleteFolder = (space: Space, env: Env, op: DeleteFolder): OpResult => {
  const folders = pageFoldersOf(space.schema);
  const folder = findFolderByRef(space.schema, op.ref);
  if (!folder) {
    return fail('ref', `Folder "${op.ref}" not found`, 'Read plitzi://folders for valid refs');
  }

  // Promote the folder's contents one level up: child folders and its pages move to its parent (or the root).
  const newParent = folder.parentId;
  for (const child of folders) {
    if (child.parentId === folder.id) {
      if (newParent === undefined) {
        Reflect.deleteProperty(child, 'parentId');
      } else {
        child.parentId = newParent;
      }
    }
  }

  for (const el of Object.values(space.schema.flat)) {
    if (isPageElement(space.schema, el) && el.attributes.folder === folder.id) {
      // A page's folder is always '' (root) or a valid id, never a missing key — so promote to '' at the root.
      el.attributes.folder = newParent ?? '';
    }
  }

  space.schema.pageFolders = sortFolders(folders.filter(f => f.id !== folder.id));

  return { ...empty(), deleted: 1, staleResources: [folderUri(env, folder.id), foldersUri(env), pagesUri(env)] };
};
