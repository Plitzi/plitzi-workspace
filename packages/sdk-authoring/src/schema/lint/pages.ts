import { hasTemplateSyntax } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { ACCESS_LEVELS } from '../guard';
import { didYouMean } from '../suggest';
import { textOf } from './context';

import type { LintContext } from './context';

/**
 * Where a link in `page` mode, or a `navigate` to a page, goes: a page named by its id, or a path read as the path it
 * is. A full URL there — `https:`, `mailto:`, `tel:` — renders as a path inside the space and a click navigates to it
 * in-app, so it is refused; a bare name that is no page's id is a typo.
 */
export const checkPageTarget = (
  ctx: LintContext,
  target: string,
  where: string,
  field: 'mode' | 'urlType',
  id: string
): void => {
  if (target === '' || target.startsWith('#') || target.startsWith('/') || hasTemplateSyntax(target)) {
    return;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    ctx.error(
      'page-target-url',
      `${where} is "${target}", a full URL, in page mode — it would render as a path inside the space. Write \`${field}: 'external'\` for it.`,
      id
    );

    return;
  }

  // A document with no pages — a template, dropped into a space later — has nothing to hold a page id against.
  if (ctx.pageIds.size > 0 && !ctx.pageIds.has(target)) {
    ctx.error(
      'page-target-unknown',
      `${where} names the page "${target}", and no page has that id${didYouMean(target, ctx.pageIds) || '.'} A page is named by its \`id\`; a path is written with its leading slash ('/about').`,
      id
    );
  }
};

/** The route prefix a folder contributes, through its parents. */
const folderPath = (ctx: LintContext, folderId: string): string => {
  const byId = new Map(ctx.schema.pageFolders.map(folder => [folder.id, folder]));
  const parts: string[] = [];
  const seen = new Set<string>();
  for (let folder = byId.get(folderId); folder && !seen.has(folder.id); folder = byId.get(folder.parentId ?? '')) {
    seen.add(folder.id);
    parts.unshift(folder.slug);
  }

  return parts.join('/');
};

/**
 * Pages: who each is for, and that no two answer the same visitors at one address — the router takes one and the
 * other can never be reached. Two pages on one path is a supported shape only when they differ by `accessLevel`: a
 * sign-in page and the page behind it.
 */
export const lintPages = (ctx: LintContext): void => {
  const routes = new Map<string, string>();
  for (const pageId of ctx.pageIds) {
    const page = ctx.element(pageId);
    if (!page) {
      continue;
    }

    const where = ctx.describe(pageId);
    const { accessLevel, slug, folder } = page.attributes;
    if (accessLevel !== undefined && accessLevel !== '' && !ACCESS_LEVELS.includes(accessLevel as 'public')) {
      ctx.error(
        'page-access-level',
        `${where}: \`accessLevel\` is ${JSON.stringify(accessLevel)}. It is one of ${ACCESS_LEVELS.map(level => `'${level}'`).join(', ')}.`,
        pageId
      );
    }

    // Every page answers at its own slug — the default one at `/` as well, which the structural validator watches.
    const path = `/${[typeof folder === 'string' && folder ? folderPath(ctx, folder) : '', textOf(slug)].filter(Boolean).join('/')}`;
    const key = `${path} ${typeof accessLevel === 'string' && accessLevel ? accessLevel : 'everyone'}`;
    const earlier = routes.get(key);
    if (earlier !== undefined) {
      ctx.error(
        'page-route-taken',
        `${where} answers at ${path} for the same visitors as ${earlier}, so one of them can never be reached. Give it another slug — or, for a sign-in page and the page behind it, \`accessLevel\` 'public' on one and 'authenticated' on the other.`,
        pageId
      );
    } else {
      routes.set(key, where);
    }
  }
};
