import { DOCUMENT_SCROLLS, isDocumentScroll } from '@plitzi/sdk-elements/elements/declarations';
import { FUNCTION_ROUTES_PREFIX, isFunctionRoutePath } from '@plitzi/sdk-shared/actions';
import { getSourceName } from '@plitzi/sdk-shared/dataSource/helpers';
import { hasTemplateSyntax, inspectTemplate } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { matchPath } from '@plitzi/sdk-shared/navigation';
import { collectServerElements } from '@plitzi/sdk-shared/schema';

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
  id: string,
  { bound = false }: { bound?: boolean } = {}
): void => {
  if (target.startsWith('/') && !hasTemplateSyntax(target)) {
    if (!bound) {
      checkPagePath(ctx, target, where, field, id);
    }

    return;
  }

  if (target === '' || target.startsWith('#') || hasTemplateSyntax(target)) {
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

/** The path a page answers at: its folders' slugs, then its own. */
const pagePath = (ctx: LintContext, pageId: string): string | undefined => {
  const page = ctx.element(pageId);
  if (!page) {
    return undefined;
  }

  const { slug, folder } = page.attributes;

  return `/${[typeof folder === 'string' && folder ? folderPath(ctx, folder) : '', textOf(slug)].filter(Boolean).join('/')}`;
};

/**
 * A path in page mode that no page answers — a page not written yet, or a typo — is followed in-app to the 404 page.
 * Not checked: what is not a page's to answer — a file (`/logo.png`, `/data/x.json`), the platform's own (`/_…`), the
 * space's functions (`/fn/…`) — nor anything when a page answers every path but the 404's.
 */
const checkPagePath = (
  ctx: LintContext,
  target: string,
  where: string,
  field: 'mode' | 'urlType',
  id: string
): void => {
  const [pathname = '/'] = target.split(/[?#]/);
  const last = pathname.split('/').at(-1) ?? '';
  if (pathname.startsWith('/_') || isFunctionRoutePath(pathname) || /\.[a-z0-9]+$/i.test(last)) {
    return;
  }

  const routes = [...ctx.pageIds].flatMap(pageId => pagePath(ctx, pageId) ?? []).filter(path => path !== '/*');
  if (routes.length === 0 || routes.some(route => matchPath(route, pathname))) {
    return;
  }

  ctx.warn(
    'page-path-unknown',
    `${where} is "${target}", and no page answers at ${pathname}: a click lands on the 404 page${didYouMean(pathname, new Set(routes)) || '.'} Link to a path a page answers, or write \`${field}: 'external'\` for one the server answers itself.`,
    id
  );
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

/** Every text a JSON-LD value holds, however deep: each may be a template the server evaluates as the title. */
const textsIn = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(textsIn)
      : typeof value === 'object' && value !== null
        ? Object.values(value).flatMap(textsIn)
        : [];

/** One expression, whole: what a `notFound` is, and anything else is never `true`. */
const ONE_EXPRESSION = /^\s*\{\{[\s\S]*\}\}\s*$/;

/**
 * A page's title, description, `notFound` and the texts of its JSON-LD written as templates are evaluated by the server as it answers — the head,
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
  const templates: { attribute: string; field: string; template: unknown }[] = [
    ...PAGE_TEMPLATES.map(([attribute, field]) => ({ attribute, field, template: page?.attributes[attribute] })),
    ...textsIn(page?.attributes.seoStructuredData).map(text => ({
      attribute: 'seoStructuredData',
      field: 'structuredData',
      template: text
    }))
  ];
  for (const { attribute, field, template } of templates) {
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

/** A page `access`'s permissions as written — whatever they hold — or nothing when it has no list. */
const permissionsOf = (access: unknown): unknown[] | undefined =>
  typeof access === 'object' && access !== null && 'permissions' in access && Array.isArray(access.permissions)
    ? access.permissions
    : undefined;

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
    const { accessLevel, documentScroll } = page.attributes;
    if (accessLevel !== undefined && accessLevel !== '' && !ACCESS_LEVELS.includes(accessLevel as 'public')) {
      ctx.error(
        'page-access-level',
        `${where}: \`accessLevel\` is ${JSON.stringify(accessLevel)}. It is one of ${ACCESS_LEVELS.map(level => `'${level}'`).join(', ')}.`,
        pageId
      );
    }

    // Kept by the server, which reads only a list of names: anything else would be a page anybody may see, silently.
    const { access } = page.attributes;
    const listed = permissionsOf(access);
    if (
      access !== undefined &&
      (!listed || listed.length === 0 || listed.some(name => typeof name !== 'string' || !name))
    ) {
      ctx.error(
        'page-access',
        `${where}: \`access\` is ${JSON.stringify(access)}. It is \`{ permissions: ['…'] }\`, every one a permission name and at least one — or left out, for a page anybody may see.`,
        pageId
      );
    }

    if (documentScroll !== undefined && documentScroll !== '' && !isDocumentScroll(documentScroll)) {
      ctx.error(
        'attribute-value',
        `${where}: \`documentScroll\` is ${JSON.stringify(documentScroll)}${(typeof documentScroll === 'string' && didYouMean(documentScroll, DOCUMENT_SCROLLS)) || '.'} It is one of ${DOCUMENT_SCROLLS.map(value => `'${value}'`).join(', ')} — or left out, for a page that scrolls as any does.`,
        pageId
      );
    }

    // Every page answers at its own slug — the default one at `/` as well, which the structural validator watches.
    const path = pagePath(ctx, pageId) ?? '/';
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
