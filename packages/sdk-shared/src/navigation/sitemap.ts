import { getPageFullPath, getSlugParams, NOT_FOUND_SLUG } from './routes';
import { pageAccessOf } from '../schema/pageAccess';

import type { Element, PageFolder, Schema } from '../types';

/**
 * Why a page is not in the space's `/sitemap.xml` — each a reason a search engine has nothing to list: a page only a
 * signed-in visitor or a role may open, an address made of parameters (one page per record, which no list of the space
 * can name), the page of every address nobody answers, a page that says `noindex`, or one shown behind a feature flag.
 */
export type SitemapExclusion = 'signedIn' | 'restricted' | 'parameters' | 'notFound' | 'noindex' | 'flagged';

/** Each reason in the words a person reads it in — the builder's map of pages says them on each page left out. */
export const SITEMAP_EXCLUSION_WORDS: Record<SitemapExclusion, string> = {
  signedIn: 'Signed-in visitors only',
  restricted: 'Only for some roles',
  parameters: 'Its address takes parameters',
  notFound: 'The page of unknown addresses',
  noindex: 'Says noindex',
  flagged: 'Behind a feature flag'
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Why this page is left out of the sitemap, or nothing: a search engine may read it, and the sitemap lists it. */
export const sitemapExclusion = (page: Element): SitemapExclusion | undefined => {
  const { attributes, definition } = page;
  if (attributes.accessLevel === 'authenticated') {
    return 'signedIn';
  }

  if (pageAccessOf(attributes)) {
    return 'restricted';
  }

  const slug = text(attributes.slug);
  if (slug === NOT_FOUND_SLUG || slug.endsWith(`/${NOT_FOUND_SLUG}`)) {
    return 'notFound';
  }

  if (getSlugParams(slug).length > 0 || slug.includes('*')) {
    return 'parameters';
  }

  // A page's robots are written only while its SEO is on (`seoEnabled`), and so are only then its word.
  if (attributes.seoEnabled === true && /\bnoindex\b/i.test(text(attributes.seoRobots))) {
    return 'noindex';
  }

  return definition.flag ? 'flagged' : undefined;
};

/** The pages of a schema by id, as the router reads them. */
const pagesOf = (schema: Pick<Schema, 'flat' | 'pages'>): Record<string, Element> =>
  Object.fromEntries(
    schema.pages.flatMap(pageId => {
      const page = schema.flat[pageId] as Element | undefined;

      return page ? [[pageId, page] as const] : [];
    })
  );

/**
 * Every address of the space a search engine may read, once each and sorted: its pages left in by
 * {@link sitemapExclusion}, at the path a link to each resolves to (its folders' slugs before its own).
 */
export const sitemapPaths = (schema: Pick<Schema, 'flat' | 'pages' | 'pageFolders'>): string[] => {
  const pages = pagesOf(schema);
  const folders: PageFolder[] = schema.pageFolders;
  const paths = Object.entries(pages)
    .filter(([, page]) => !sitemapExclusion(page))
    .map(([pageId]) => getPageFullPath(pages, folders, pageId, true));

  return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
};
