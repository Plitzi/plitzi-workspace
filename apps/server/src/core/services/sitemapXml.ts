import { sitemapPaths } from '@plitzi/sdk-shared/navigation';

import { requestOrigin } from '../requestParser';
import { servedSpace } from './servedSpace';

import type { SSRContext, Stage } from '../http/types';

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, character => XML_ESCAPES[character] ?? character);

/**
 * `/sitemap.xml`: every page of the space a search engine may read (`sitemapPaths` — the same pages the builder's map
 * marks as listed), at this address's origin, so a space answers its own on its own domain and on the platform's.
 * A space that cannot be read answers an empty list rather than an error: a crawler retries an error, and lists nothing.
 */
export const sitemapXmlStage: Stage<SSRContext> = async ctx => {
  const { req } = ctx;
  if (req.method !== 'GET' || req.path !== '/sitemap.xml') {
    return false;
  }

  ctx.operation = 'sitemap';
  const schema = (await servedSpace(ctx, '/sitemap.xml'))?.schema;
  const origin = requestOrigin(req);
  const urls =
    schema && origin
      ? sitemapPaths(schema).map(path => `  <url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`)
      : [];
  ctx.res.setStatus(200);
  ctx.res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  ctx.res.send(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls,
      '</urlset>',
      ''
    ].join('\n')
  );

  return true;
};
