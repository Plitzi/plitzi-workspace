import { contentTypeOf } from './contentType';
import { digestOf, fingerprintOf } from './fingerprint';
import { buildVersions } from './sdkFiles';

import type { BuiltSite, DeployLog, SiteFile } from './types';

/**
 * A space prerendered: every page a page server draws, read from it as a browser would and kept
 * as HTML, with every file of the same origin those pages load — the SDK, the stylesheets, the fonts, the images —
 * beside them at the paths they are asked for. The pages are the content, so every publish of one is a deploy.
 *
 * Which pages: the routes it is given, and every internal link found in them, followed (§14 decision 2). A route with
 * parameters that no page links to is not guessed: it is reported by name, never left out silently.
 */

/** What the page server answered for one path. */
export interface FetchedPage {
  status: number;
  /** Its media type, as the `Content-Type` said. */
  type: string;
  body: Uint8Array;
}

export interface StaticSiteInput {
  /** Asks the page server for a path of the site (`/menu`, `/sdk-assets/plitzi-sdk.js?v=1`), as a visitor's browser would. */
  fetchPage: (path: string) => Promise<FetchedPage>;
  /** The routes to start from: the space's pages, `/blog/:slug` included — a pattern is only reported, never fetched. */
  routes: string[];
  /** The addresses of a parameterised route to prerender, listed by the target (`/blog/hello`). */
  extraPaths?: string[];
  /** At most this many pages. */
  maxPages?: number;
  log: DeployLog;
  signal?: AbortSignal;
  /** What the deploy is built from, for its fingerprint (`production@12`). */
  version: string;
}

export interface StaticSite extends BuiltSite {
  /** Routes with parameters no page linked to and the target did not list: not prerendered. */
  unreached: string[];
}

const DEFAULT_MAX_PAGES = 500;
/** An address the site has no page for: its 404 page, kept as `404.html`. */
const NOT_FOUND_PROBE = '/__plitzi-not-found__';

const decoder = new TextDecoder();

/** An address of the same origin, without its fragment; nothing for another origin, a `data:` or a `mailto:`. */
const sameOrigin = (raw: string): string | undefined => {
  const value = raw.trim().replace(/&amp;/g, '&');
  if (!value.startsWith('/') || value.startsWith('//')) {
    return undefined;
  }

  return value.split('#')[0] || undefined;
};

/** The file a path is kept as: `/` → `index.html`, `/menu` → `menu/index.html`, `/a.js?v=1` → `a.js`. */
export const fileOf = (path: string, html: boolean): string => {
  const clean = decodeURIComponent(path.split('?')[0]).replace(/^\/+/, '');
  if (!html) {
    return clean;
  }

  return clean === '' ? 'index.html' : clean.endsWith('.html') ? clean : `${clean.replace(/\/+$/, '')}/index.html`;
};

/** The first group of a match that took part in it: `(?:"(a)"|'(b)')` is either. */
const firstGroup = (match: RegExpMatchArray): string | undefined =>
  match.slice(1).find(group => typeof group === 'string');

/** The pages an HTML document links to, and the files it loads (scripts, stylesheets, images, the import map's). */
export const linksOf = (html: string): { pages: string[]; files: string[] } => {
  const pages = new Set<string>();
  const files = new Set<string>();
  const add = (into: Set<string>, raw: string | undefined) => {
    const path = sameOrigin(raw ?? '');
    if (path) {
      into.add(path);
    }
  };

  for (const match of html.matchAll(/<a\b[^>]*?\shref=(?:"([^"]*)"|'([^']*)')/gi)) {
    add(pages, firstGroup(match));
  }

  // A `<link>`'s href is a file (a stylesheet, a preload, an icon); an `<a>`'s is a page, read above.
  for (const match of html.matchAll(/<link\b[^>]*?\shref=(?:"([^"]*)"|'([^']*)')/gi)) {
    add(files, firstGroup(match));
  }

  for (const match of html.matchAll(/\s(?:src|poster|data-src)=(?:"([^"]*)"|'([^']*)')/gi)) {
    add(files, firstGroup(match));
  }

  for (const match of html.matchAll(/\ssrcset=(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const candidate of (firstGroup(match) ?? '').split(',')) {
      add(files, candidate.trim().split(/\s+/)[0]);
    }
  }

  for (const match of html.matchAll(/<script type="importmap"[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const value of match[1].matchAll(/"(\/[^"]+)"/g)) {
      add(files, value[1]);
    }
  }

  // The page server's own files a page names in its data (the space's document, its parts): kept so the page that
  // asks for them on its first load finds them; a part not kept is a page loaded whole from its address.
  for (const match of html.matchAll(/["'](\/_plitzi\/[\w./-]+\.(?:json|css|js))["']/g)) {
    add(files, match[1]);
  }

  return { pages: [...pages], files: [...files] };
};

/** The files a stylesheet loads (`url(...)`, `@import`), resolved against where it is. */
export const cssFilesOf = (css: string, at: string): string[] => {
  const base = new URL(at, 'https://site.invalid');
  const found = new Set<string>();
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g)) {
    const raw = ([match[2], match[4]].find(group => typeof group === 'string') ?? '').trim();
    if (!raw || raw.startsWith('data:') || /^[a-z]+:/i.test(raw) || raw.startsWith('//')) {
      continue;
    }

    const resolved = new URL(raw, base);
    found.add(`${resolved.pathname}${resolved.search}`);
  }

  return [...found];
};

const isPattern = (route: string): boolean => /[:*]/.test(route);

export const buildStaticSite = async ({
  fetchPage,
  routes,
  extraPaths = [],
  maxPages = DEFAULT_MAX_PAGES,
  log,
  signal,
  version
}: StaticSiteInput): Promise<StaticSite> => {
  const files = new Map<string, SiteFile>();
  const pagesSeen = new Set<string>();
  const filesSeen = new Set<string>();
  const queue = [...new Set(['/', ...routes.filter(route => !isPattern(route)), ...extraPaths])];
  const patterns = routes.filter(isPattern);
  const reached: string[] = [];
  const failed: string[] = [];

  const keepFile = async (path: string): Promise<void> => {
    if (filesSeen.has(path)) {
      return;
    }

    filesSeen.add(path);
    signal?.throwIfAborted();
    const answer = await fetchPage(path);
    if (answer.status !== 200) {
      failed.push(`${path} (${String(answer.status)})`);

      return;
    }

    const name = fileOf(path, false);
    files.set(name, {
      path: name,
      body: answer.body,
      type: answer.type || contentTypeOf(name),
      // A file asked for with a version in its address changes its address when it changes.
      cache: path.includes('?') || /[.-][0-9a-f]{8,}\./i.test(name) ? 'immutable' : 'revalidate'
    });
    if (answer.type.includes('css')) {
      for (const inner of cssFilesOf(decoder.decode(answer.body), path)) {
        await keepFile(inner);
      }
    }
  };

  while (queue.length > 0) {
    const path = queue.shift() ?? '/';
    const page = path.split('?')[0];
    if (pagesSeen.has(page)) {
      continue;
    }

    if (pagesSeen.size >= maxPages) {
      log(`Stopped at ${String(maxPages)} pages: the rest of the site was not prerendered`, 'warn');
      break;
    }

    pagesSeen.add(page);
    signal?.throwIfAborted();
    const answer = await fetchPage(page);
    if (answer.status !== 200 || !answer.type.includes('html')) {
      failed.push(`${page} (${String(answer.status)})`);
      continue;
    }

    const html = decoder.decode(answer.body);
    files.set(fileOf(page, true), {
      path: fileOf(page, true),
      body: answer.body,
      type: 'text/html; charset=utf-8',
      cache: 'revalidate'
    });
    reached.push(page);
    const links = linksOf(html);
    for (const file of links.files) {
      await keepFile(file);
    }

    for (const link of links.pages) {
      const target = link.split('?')[0];
      if (!pagesSeen.has(target) && !/\.[a-z0-9]{1,5}$/i.test(target)) {
        queue.push(target);
      }
    }
  }

  const notFound = await fetchPage(NOT_FOUND_PROBE);
  if (notFound.type.includes('html')) {
    files.set('404.html', {
      path: '404.html',
      body: notFound.body,
      type: 'text/html; charset=utf-8',
      cache: 'revalidate'
    });
    for (const file of linksOf(decoder.decode(notFound.body)).files) {
      await keepFile(file);
    }
  }

  // A route with parameters is reached when a page linked to an address it matches.
  const unreached = patterns.filter(pattern => {
    const matcher = new RegExp(
      `^${pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:[^/]+/g, '[^/]+')
        .replace(/\*/g, '.*')}$`
    );

    return !reached.some(path => matcher.test(path));
  });

  log(`Prerendered ${String(reached.length)} pages and ${String(files.size - reached.length)} files they load`);
  if (unreached.length > 0) {
    log(
      `Not prerendered — no page links to an address of: ${unreached.join(', ')}. List the addresses to prerender in the target’s settings`,
      'warn'
    );
  }

  if (failed.length > 0) {
    log(`The page server did not answer: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`, 'warn');
  }

  const sorted = [...files.values()].sort((a, b) => (a.path < b.path ? -1 : 1));

  return {
    files: sorted,
    fingerprint: fingerprintOf({
      version,
      content: digestOf(sorted.map(file => [file.path, digestOf(decoder.decode(file.body))]))
    }),
    versions: buildVersions(),
    unreached
  };
};
