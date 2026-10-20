import { isRecord } from '@plitzi/sdk-shared/helpers';
import { getSlugParams } from '@plitzi/sdk-shared/navigation';

import { AuthoringError } from './codes';
import { pathForSlug } from './handles';
import { didYouMean } from './suggest';

import type { PageFolderSpec, PageSpec } from './types';

/**
 * A space's navigation read off its pages (`PageSpec.nav`): the links a layout draws, so a page joins the menu by saying
 * so in its own file — no list in the layout, no line in the entry that every new page edits, the file two agents (or
 * two people) adding pages at once would both change.
 *
 * ```ts
 * const pages = await pagesIn(new URL('./pages/', import.meta.url));
 * export const space: SpaceSpec = { …, layouts: [siteLayout(navOf(pages))], pages };
 * // in layout.ts: nav.map(entry => link({ href: entry.href, content: entry.label, current: entry.current }))
 * ```
 */

/** One link of the navigation, in the order it is shown. */
export interface NavEntry {
  label: string;
  /** The page's address, its folders' slugs before its own. */
  href: string;
  /** `section` when other pages live under it — `/pets` for `/pets/rex` — so its link stays current on them too. */
  current: 'page' | 'section';
  page: PageSpec;
}

/** Each folder's part of its pages' addresses, its parents' first: what `folder` puts before a page's slug. */
export const folderPrefixes = (folders: readonly PageFolderSpec[]): Map<string, string> => {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const prefixes = new Map<string, string>();
  for (const folder of folders) {
    const segments: string[] = [];
    const seen = new Set<string>();
    for (let current: PageFolderSpec | undefined = folder; current && !seen.has(current.id);) {
      seen.add(current.id);
      segments.unshift(current.slug ?? current.id);
      current = current.parent === undefined ? undefined : byId.get(current.parent);
    }

    prefixes.set(folder.id, segments.filter(Boolean).join('/'));
  }

  return prefixes;
};

/** Where a page answers: `/` for the default one, else its folders' slugs and its own. */
export const routeOf = (page: PageSpec, prefixes: ReadonlyMap<string, string>): string =>
  page.isDefault
    ? '/'
    : pathForSlug(
        [page.folder === undefined ? '' : (prefixes.get(page.folder) ?? ''), page.slug].filter(Boolean).join('/')
      );

/** A page's `nav` held to what `navOf` can list: a label, a number for its order, and one address — no param in it. */
export const assertPageNav = (page: PageSpec): void => {
  if (page.nav === undefined) {
    return;
  }

  // Read as the record it was written as: a project in plain JavaScript reaches here unchecked by the compiler.
  const nav: unknown = page.nav;
  const where = `Page "${page.name}"'s nav`;
  if (!isRecord(nav) || typeof nav.label !== 'string' || nav.label.trim() === '') {
    throw new AuthoringError('page-nav-invalid', `${where} has no label: \`nav: { label: 'Pets' }\``);
  }

  if (nav.order !== undefined && (typeof nav.order !== 'number' || !Number.isFinite(nav.order))) {
    throw new AuthoringError('page-nav-invalid', `${where} has an order that is no number: \`order: 3\`, lowest first`);
  }

  const params = getSlugParams(page.slug);
  if (params.length > 0) {
    throw new AuthoringError(
      'page-nav-invalid',
      `${where} lists a page with no one address — its path takes ${params.map(param => `:${param}`).join(', ')}: list the page its records are reached from instead`
    );
  }
};

/**
 * The links of the pages that say `nav`, lowest `order` first, then those without one by label. `pageFolders` is the
 * space's, for the pages filed in one; a page in a folder it does not name is refused, as the space refuses it.
 */
export const navOf = (
  pages: readonly PageSpec[],
  { pageFolders = [] }: { pageFolders?: readonly PageFolderSpec[] } = {}
): NavEntry[] => {
  const prefixes = folderPrefixes(pageFolders);
  const routes = pages.map(page => {
    if (page.folder !== undefined && !prefixes.has(page.folder)) {
      throw new AuthoringError(
        'folder-undeclared',
        `Page "${page.name}" is in folder "${page.folder}", which navOf was not given${didYouMean(page.folder, [...prefixes.keys()])}: navOf(pages, { pageFolders })`
      );
    }

    return routeOf(page, prefixes);
  });

  return pages
    .flatMap((page, index) => {
      if (page.nav === undefined) {
        return [];
      }

      assertPageNav(page);
      const href = routes[index] ?? '/';
      const current: NavEntry['current'] =
        href !== '/' && routes.some(route => route.startsWith(`${href}/`)) ? 'section' : 'page';

      return [{ label: page.nav.label, href, current, page, order: page.nav.order ?? Infinity }];
    })
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label) || a.href.localeCompare(b.href))
    .map(({ label, href, current, page }) => ({ label, href, current, page }));
};
