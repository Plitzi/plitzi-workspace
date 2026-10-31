import { afterEach, describe, expect, it, vi } from 'vitest';

import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../createServer';
import { unusedPort } from '../unusedPort';
import { AI_CRAWLERS, DEFAULT_ROBOTS_TXT } from './robotsTxt';

import type { OfflineDataRaw, SSRServer } from '@plitzi/sdk-shared';

/**
 * A space's /robots.txt: its own, or one that lets crawlers read everything — never its page for an unknown address — and
 * its sitemap's address; the AI crawlers kept out when the space says so.
 */

let server: SSRServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

const serve = async (settings: Record<string, unknown>, schema: Record<string, unknown> = {}): Promise<string> => {
  const port = await unusedPort();
  // Only what these files read: the settings, and for the sitemap its pages.
  const offlineData = {
    schema: { elements: {}, flat: {}, pages: [], pageFolders: [], ...schema, settings },
    style: {}
  } as unknown as OfflineDataRaw;
  server = createServer({
    port,
    devMode: true,
    adapters: { ...createJsonAdapters({ offlineData }), authenticate: () => Promise.resolve(undefined) }
  });
  await server.listen(port, '127.0.0.1');
  const base = `http://127.0.0.1:${String(port)}`;
  await vi.waitFor(async () => {
    expect((await fetch(`${base}/robots.txt`)).status).toBeLessThan(500);
  });

  return base;
};

describe('a space’s /robots.txt', () => {
  it('is the space’s own, as plain text', async () => {
    const base = await serve({ customCss: '', robotsTxt: 'User-agent: *\nDisallow: /overlay' });
    const answer = await fetch(`${base}/robots.txt`);

    expect(answer.status).toBe(200);
    expect(answer.headers.get('content-type')).toContain('text/plain');
    expect(await answer.text()).toBe(`User-agent: *\nDisallow: /overlay\n\nSitemap: ${base}/sitemap.xml\n`);
  });

  it('names no sitemap of its own when the space’s text already names one', async () => {
    const own = 'User-agent: *\nAllow: /\nSitemap: https://cdn.example.com/map.xml';
    const base = await serve({ customCss: '', robotsTxt: own });

    expect(await (await fetch(`${base}/robots.txt`)).text()).toBe(`${own}\n`);
  });

  it('keeps every AI crawler out when the space says so, and search engines in', async () => {
    const base = await serve({ customCss: '', blockAiCrawlers: true });
    const text = await (await fetch(`${base}/robots.txt`)).text();

    expect(text.startsWith(DEFAULT_ROBOTS_TXT)).toBe(true);
    for (const agent of AI_CRAWLERS) {
      expect(text).toContain(`User-agent: ${agent}\nDisallow: /`);
    }

    expect(text).not.toContain('Googlebot');
  });

  it('lets crawlers read everything when the space says nothing', async () => {
    const base = await serve({ customCss: '' });

    expect(await (await fetch(`${base}/robots.txt`)).text()).toBe(
      `${DEFAULT_ROBOTS_TXT}\nSitemap: ${base}/sitemap.xml\n`
    );
  });
});

describe('a space’s /sitemap.xml', () => {
  const page = (id: string, attributes: Record<string, unknown>) => ({
    id,
    attributes: { default: false, folder: '', ...attributes },
    definition: { rootId: id, label: id, type: 'page', items: [], styleSelectors: { base: '' } }
  });

  it('lists the pages a search engine may read, at the address it was asked on, and none of the rest', async () => {
    const pages = [
      page('home', { slug: '', default: true }),
      page('pricing', { slug: 'pricing' }),
      page('account', { slug: 'account', accessLevel: 'authenticated' }),
      page('post', { slug: ':slug' })
    ];
    const base = await serve(
      { customCss: '' },
      { pages: pages.map(each => each.id), flat: Object.fromEntries(pages.map(each => [each.id, each])) }
    );
    const answer = await fetch(`${base}/sitemap.xml`);
    const xml = await answer.text();

    expect(answer.status).toBe(200);
    expect(answer.headers.get('content-type')).toContain('application/xml');
    expect(xml).toContain(`<loc>${base}/</loc>`);
    expect(xml).toContain(`<loc>${base}/pricing</loc>`);
    expect(xml).not.toContain('account');
    expect(xml).not.toContain(':slug');
  });
});
