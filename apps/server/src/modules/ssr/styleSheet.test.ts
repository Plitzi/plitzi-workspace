import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { offlineDataOf } from './tests/offlineData';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';
import { unusedPort } from '../../core/unusedPort';

import type { OfflineDataRaw, SSRServer } from '@plitzi/sdk-shared';

/**
 * The space's compiled stylesheet beside the page, over real HTTP: the page links it instead of carrying it, and any
 * process answers it from the space — kept for good under its name, because it is the name of that text.
 */

const PORT = await unusedPort();
const base = `http://127.0.0.1:${String(PORT)}`;

const CACHE = '.hero{color:#123456}.hero:hover{color:#654321}';

const styled = (cache: string): OfflineDataRaw => {
  const space = offlineDataOf();

  return { ...space, style: { ...space.style, cache } };
};

let offlineData = styled(CACHE);

let server: SSRServer;

const sheetHref = (html: string): string | undefined =>
  /<head>[\s\S]*<link id="plitzi-style" href="(\/_plitzi\/style\/[\w-]+\.css)" rel="stylesheet" \/>[\s\S]*<\/head>/.exec(
    html
  )?.[1];

beforeAll(async () => {
  server = createServer({
    port: PORT,
    devMode: true,
    adapters: { ...createJsonAdapters({ offlineData }), getOfflineData: () => Promise.resolve(offlineData) }
  });
  await server.listen(PORT, '127.0.0.1');

  await vi.waitFor(async () => {
    expect((await fetch(`${base}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('modules/ssr/styleSheet', () => {
  // In the head, so the page is painted with it from its first frame: in the body it was not, and the theme flashed.
  it('links the stylesheet from the page’s head, and leaves its rules out of the page', async () => {
    const html = await (await fetch(`${base}/`)).text();

    expect(sheetHref(html)).toBeDefined();
    expect(html).not.toContain('.hero{color:#123456}');
  });

  it('answers the link with the stylesheet, to be kept for good', async () => {
    const html = await (await fetch(`${base}/`)).text();
    const response = await fetch(`${base}${sheetHref(html) ?? ''}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await response.text()).toContain(CACHE);
  });

  // The space changed after the page was drawn: it is styled as the space now is, rather than not at all.
  it('answers a name that is not the stylesheet’s with the stylesheet as it is, kept by nobody', async () => {
    const response = await fetch(`${base}/_plitzi/style/not-this-one.css`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toContain(CACHE);
  });

  // The token names a space other than the host's: its file would be asked for by the host and answered with another.
  it('carries the stylesheet on a page that named its space by a token', async () => {
    const html = await (await fetch(`${base}/?access-token=a.b`)).text();

    expect(sheetHref(html)).toBeUndefined();
  });

  it('carries a stylesheet whose tokens each request resolves', async () => {
    offlineData = styled('.hero{color:{{ brand }}}');
    try {
      const html = await (await fetch(`${base}/`)).text();

      expect(sheetHref(html)).toBeUndefined();
      expect((await fetch(`${base}/_plitzi/style/any.css`)).status).toBe(404);
    } finally {
      offlineData = styled(CACHE);
    }
  });
});
