import { requestOrigin } from '@plitzi/sdk-kernel/http';
import { sitemapPages } from '@plitzi/sdk-shared/navigation';

import { servedSpace } from './servedSpace';
import { resolvePageSeo } from '../../modules/ssr/resolvePageSeo';

import type { SSRContext } from '../http/pageContext';
import type { Stage } from '@plitzi/sdk-kernel/http';
import type { Schema } from '@plitzi/sdk-shared';

export const LLMS_TXT_PATH = '/llms.txt';

/** A line of Markdown that cannot break the list it is in: no line break, no bracket that closes a link early. */
const inline = (value: string): string => value.replace(/\s+/g, ' ').replace(/[[\]]/g, '').trim();

/**
 * The index an assistant reads (llmstxt.org): the site's name, the home page's description as its summary, and a link
 * to each page the sitemap lists with its SEO title and description — the same words a search result shows.
 */
export const llmsTxtOf = (schema: Schema, origin: string): string => {
  const pages = sitemapPages(schema).map(page => ({ ...page, seo: resolvePageSeo(schema, page.pageId) }));
  const home = pages.find(page => page.path === '/');
  const name = inline(schema.settings.siteName ?? home?.seo.title ?? new URL(origin).hostname);
  const summary = home?.seo.description ? inline(home.seo.description) : '';
  const links = pages.map(({ path, seo }) => {
    const title = inline(seo.title ?? path);
    const description = seo.description ? `: ${inline(seo.description)}` : '';

    return `- [${title}](${origin}${path})${description}`;
  });

  return [`# ${name}`, ...(summary ? [`> ${summary}`] : []), '## Pages', links.join('\n')].join('\n\n');
};

/**
 * `/llms.txt`: the space's own (`settings.llmsTxt`), or the one its pages make (`llmsTxtOf`). A space that keeps
 * assistants out (`blockAiCrawlers: ['assistants']`) answers 404 — an index for them invites what it refuses. Never the
 * space's page for that address, which an assistant would read as the index.
 */
export const llmsTxtStage: Stage<SSRContext> = async ctx => {
  const { req } = ctx;
  if (req.method !== 'GET' || req.path !== LLMS_TXT_PATH) {
    return false;
  }

  ctx.operation = 'llms';
  const schema = (await servedSpace(ctx, LLMS_TXT_PATH))?.schema;
  const origin = requestOrigin(req);
  ctx.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (!schema || !origin || schema.settings.blockAiCrawlers?.includes('assistants')) {
    ctx.res.setStatus(404);
    ctx.res.send('This site publishes no llms.txt.\n');

    return true;
  }

  const own = schema.settings.llmsTxt?.trim();
  ctx.res.setStatus(200);
  ctx.res.send(`${own || llmsTxtOf(schema, origin)}\n`);

  return true;
};
