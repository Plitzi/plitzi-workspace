import type { AccessLevel, SitemapEntry } from '../types';
import type { Element, PageFolder } from '@plitzi/sdk-shared';

const text = (attributes: Record<string, unknown>, key: string): string => {
  const value = attributes[key];

  return typeof value === 'string' ? value : '';
};

const accessOf = (attributes: Record<string, unknown>): AccessLevel => {
  switch (attributes.accessLevel) {
    case 'public':
      return 'guests';
    case 'authenticated':
      return 'signedIn';
    default:
      return 'everyone';
  }
};

const joinPath = (folderPath: string, slug: string) => `${folderPath}/${slug.replace(/^\//, '')}`;

/**
 * The site's pages and folders as a tree: each folder holding what names it as its parent, folders and pages alike
 * sorted by name, and every page with what its card shows — where it answers, who may open it, what wraps it.
 *
 * `layouts` names each layout by id: a page refers to its layout by id, and the map shows the name.
 */
const schemaToSitemap = (pages: Element[], folders: PageFolder[], layouts: Record<string, string> = {}) => {
  type Child = { type: 'folder'; data: PageFolder; name: string } | { type: 'page'; data: Element; name: string };
  const children = new Map<string, Child[]>();
  const push = (parent: string, child: Child) => children.set(parent, [...(children.get(parent) ?? []), child]);
  const pageNames = new Map(pages.map(page => [page.id, text(page.attributes, 'name') || page.id]));

  for (const folder of folders) {
    push(folder.parentId || '', { type: 'folder', data: folder, name: folder.name });
  }

  for (const page of pages) {
    push(text(page.attributes, 'folder'), { type: 'page', data: page, name: pageNames.get(page.id) ?? page.id });
  }

  const walk = (folderId: string, folderPath: string): SitemapEntry[] =>
    [...(children.get(folderId) ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((child): SitemapEntry => {
        if (child.type === 'folder') {
          const { id, name, slug } = child.data;
          const path = joinPath(folderPath, slug);

          return { type: 'folder', id, title: name, path, children: walk(id, path) };
        }

        const { id, attributes, definition } = child.data;
        const redirect = text(attributes, 'unauthorizedPageRedirect');
        // `layout` is the layout; `layoutContainer` the slot inside it the page fills, which names nothing to an author.
        const layoutId = text(attributes, 'layout');

        return {
          type: 'page',
          id,
          title: child.name,
          path: joinPath(folderPath, text(attributes, 'slug')),
          access: accessOf(attributes),
          isDefault: attributes.default === true,
          ...(layoutId ? { layout: layouts[layoutId] ?? layoutId } : {}),
          ...(definition.flag ? { flag: definition.flag } : {}),
          ...(text(attributes, 'unauthorizedBehaviour') === 'redirect' && redirect
            ? { redirectTo: pageNames.get(redirect) ?? redirect }
            : {})
        };
      });

  return walk('', '');
};

export default schemaToSitemap;
