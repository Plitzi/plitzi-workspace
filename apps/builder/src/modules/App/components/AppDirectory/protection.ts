import { notFoundWhenRefused, protectedAccessOf } from '@plitzi/sdk-shared/schema';

import type { Element, PageFolder } from '@plitzi/sdk-shared';

/** What a protected page or folder says beside its name: the lock's words, and whether all of it is protected. */
export type Protection = { says: string; whole: boolean };

/**
 * Who a page is for, in words, or nothing for a page anybody may open — read by the rule the server withholds pages
 * with (`protectedAccessOf`), so the lock and what a visitor is sent never disagree.
 */
export const pageProtection = (attributes: Record<string, unknown>): Protection | undefined => {
  const access = protectedAccessOf(attributes);
  if (!access) {
    return undefined;
  }

  const who =
    access.permissions.length > 0
      ? `Only for visitors with ${access.permissions.join(', ')}`
      : 'Only for signed-in visitors';
  // Answered as if it did not exist to everyone else: not even its path is told.
  const others = notFoundWhenRefused(attributes) ? ' — a 404 to everyone else' : '';

  return { says: `${who}${others}`, whole: true };
};

/** The folders under `id`, itself included, at any depth. */
const foldersUnder = (id: string, pageFolders: readonly PageFolder[]): Set<string> => {
  const found = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of pageFolders) {
      if (folder.parentId !== undefined && found.has(folder.parentId) && !found.has(folder.id)) {
        found.add(folder.id);
        grew = true;
      }
    }
  }

  return found;
};

/**
 * A folder's lock: every page in it — in its folders too — protected, or some of them, said with how many; nothing for a
 * folder with none, or with no pages. A folder protects nothing itself: what it says is what its pages are.
 */
export const folderProtection = (
  id: string,
  pageFolders: readonly PageFolder[],
  elements: readonly Element[]
): Protection | undefined => {
  const folders = foldersUnder(id, pageFolders);
  const folderOf = (element: Element): string =>
    typeof element.attributes.folder === 'string' ? element.attributes.folder : '';
  const pages = elements.filter(
    element => element.definition.type !== 'layoutContainer' && folders.has(folderOf(element))
  );
  const locked = pages.filter(page => protectedAccessOf(page.attributes));
  if (locked.length === 0) {
    return undefined;
  }

  return locked.length === pages.length
    ? { says: `Every page in it is protected (${String(pages.length)})`, whole: true }
    : { says: `${String(locked.length)} of its ${String(pages.length)} pages are protected`, whole: false };
};
