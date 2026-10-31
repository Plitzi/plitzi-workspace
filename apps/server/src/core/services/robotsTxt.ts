import { requestOrigin } from '../requestParser';
import { servedSpace } from './servedSpace';

import type { SSRContext, Stage } from '../http/types';

/** What a space that says nothing answers: everything may be crawled. */
export const DEFAULT_ROBOTS_TXT = 'User-agent: *\nAllow: /\n';

/**
 * The crawlers that gather pages to train AI models, by the user agent each reads `/robots.txt` as — what a space that
 * says `blockAiCrawlers` keeps out. A search engine's own crawler is none of them: Googlebot reads on, Google-Extended
 * (the one that trains) does not.
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'PerplexityBot',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent'
] as const;

const SITEMAP_LINE = /^\s*sitemap\s*:/im;

/**
 * `/robots.txt`: the space's own (`settings.robotsTxt`) or one that lets crawlers read everything, then — when the space
 * keeps them out (`settings.blockAiCrawlers`) — a `Disallow: /` for each AI crawler, and the address of its sitemap
 * unless its own text names one. Never the space's page for an address it has none for: a crawler reads a 404 page as
 * "no rules", and an HTML page as rules it cannot parse.
 */
export const robotsTxtStage: Stage<SSRContext> = async ctx => {
  const { req } = ctx;
  if (req.method !== 'GET' || req.path !== '/robots.txt') {
    return false;
  }

  ctx.operation = 'robots';
  const settings = (await servedSpace(ctx, '/robots.txt'))?.schema.settings;
  const own = settings?.robotsTxt?.trim() ? settings.robotsTxt.trim() : DEFAULT_ROBOTS_TXT.trim();
  const origin = requestOrigin(req);
  const sections = [
    own,
    ...(settings?.blockAiCrawlers ? AI_CRAWLERS.map(agent => `User-agent: ${agent}\nDisallow: /`) : []),
    ...(origin && !SITEMAP_LINE.test(own) ? [`Sitemap: ${origin}/sitemap.xml`] : [])
  ];
  ctx.res.setStatus(200);
  ctx.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  ctx.res.send(`${sections.join('\n\n')}\n`);

  return true;
};
