import { FUNCTION_ROUTES_PREFIX, isFunctionRoutePath } from '@plitzi/sdk-shared/actions';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import { hasTemplateSyntax, inspectTemplate } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { collectServerElements } from '@plitzi/sdk-shared/schema/serverElements';

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

/** A page's own templates, by the attribute the document holds and the field of the page that writes it. */
const PAGE_TEMPLATES = [
  ['seoPageTitle', 'seoTitle'],
  ['seoPageDescription', 'seoDescription'],
  ['notFound', 'notFound']
] as const;

/** One expression, whole: what a `notFound` is, and anything else is never `true`. */
const ONE_EXPRESSION = /^\s*\{\{[\s\S]*\}\}\s*$/;

/**
 * A page's title, description and `notFound` written as templates are evaluated by the server as it answers — the head,
 * the status — and the title again in the browser over the same answers: they read only what is there by then, the
 * server providers of the page and of its layouts by their source names (`apiContainer_capsule`), and `navigation`.
 * Anything else is not there yet: the head would carry the deployment's own title, and the address would answer 200.
 */
const checkPageTemplates = (ctx: LintContext, pageId: string, where: string): void => {
  const page = ctx.element(pageId);
  const providers = collectServerElements({ flat: ctx.flat }, pageId).map(element =>
    getSourceName(element.definition.type, element.id)
  );
  const readable = new Set(['navigation', ...providers]);
  for (const [attribute, field] of PAGE_TEMPLATES) {
    const template = page?.attributes[attribute];
    if (attribute === 'notFound' && typeof template === 'string' && template !== '' && !ONE_EXPRESSION.test(template)) {
      ctx.error(
        'not-found-not-a-template',
        `${where} has \`notFound: ${JSON.stringify(template)}\`, which is never \`true\`: it is one expression over the page's server providers, \`'{{ not apiContainer_post.found }}'\`.`,
        pageId
      );
      continue;
    }

    if (typeof template !== 'string' || !hasTemplateSyntax(template)) {
      continue;
    }

    const { issues, freeNames } = inspectTemplate(template);
    const unreadable = freeNames.filter(name => !readable.has(name));
    if (issues.length === 0 && unreadable.length === 0) {
      continue;
    }

    const why =
      issues.length > 0
        ? `cannot be read as written — ${issues.join('; ')}`
        : `reads ${unreadable.map(name => `\`${name}\``).join(', ')}, which is not there when the server answers`;
    const can =
      providers.length > 0
        ? providers.map(name => `\`${name}\``).join(', ')
        : 'none: no provider on it runs on the server';
    ctx.error(
      'page-template',
      `${where}: \`${field}\` ${why}. A page's own templates are evaluated by the server before the page reaches the browser, from its server providers — ${can} — and \`navigation\`. Read the record from a provider with \`runtime: 'server'\` on the page (or its layout), or write words of its own.`,
      pageId
    );
  }
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
    checkPageTemplates(ctx, pageId, where);
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
    if (isFunctionRoutePath(path)) {
      ctx.error(
        'page-route-reserved',
        `${where} answers at ${path}, under ${FUNCTION_ROUTES_PREFIX} — which is where the space's functions answer, never a page. Give it another slug (or its folder another one).`,
        pageId
      );
    }

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
