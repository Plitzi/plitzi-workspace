import { requestOrigin } from '@plitzi/sdk-kernel/http';
import { blockedAiCrawlers } from '@plitzi/sdk-shared/schema';

import { servedSpace } from './servedSpace';

import type { SSRContext } from '../http/pageContext';
import type { Stage } from '@plitzi/sdk-kernel/http';

/** What a space that says nothing answers: everything may be crawled. */
export const DEFAULT_ROBOTS_TXT = 'User-agent: *\nAllow: /\n';

/** What an address made for people, never for search, answers (a snapshot's preview): nothing may be crawled. */
export const NOINDEX_ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';

const SITEMAP_LINE = /^\s*sitemap\s*:/im;

/**
 * `/robots.txt`: the space's own (`settings.robotsTxt`) or one that lets crawlers read everything, then a `Disallow: /`
 * for each AI crawler of the kinds the space keeps out (`settings.blockAiCrawlers`), and the address of its sitemap
 * unless its own text names one — and on an address that is never for search (`noindex`), nothing at all. Never the space's page for an address it has none for: a crawler reads a 404 page as
 * "no rules", and an HTML page as rules it cannot parse.
 */
export const robotsTxtStage: Stage<SSRContext> = async ctx => {
  const { req } = ctx;
  if (req.method !== 'GET' || req.path !== '/robots.txt') {
    return false;
  }

  ctx.operation = 'robots';
  ctx.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (req.ctx.spaceDeployment?.noindex) {
    ctx.res.setStatus(200);
    ctx.res.send(NOINDEX_ROBOTS_TXT);

    return true;
  }

  const settings = (await servedSpace(ctx, '/robots.txt'))?.schema.settings;
  const own = settings?.robotsTxt?.trim() ? settings.robotsTxt.trim() : DEFAULT_ROBOTS_TXT.trim();
  const origin = requestOrigin(req);
  const sections = [
    own,
    ...blockedAiCrawlers(settings?.blockAiCrawlers).map(agent => `User-agent: ${agent}\nDisallow: /`),
    ...(origin && !SITEMAP_LINE.test(own) ? [`Sitemap: ${origin}/sitemap.xml`] : [])
  ];
  ctx.res.setStatus(200);
  ctx.res.send(`${sections.join('\n\n')}\n`);

  return true;
};
