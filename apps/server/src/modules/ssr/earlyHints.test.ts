import { request } from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { unusedPort } from '@plitzi/sdk-kernel/http';

import { pageLinks } from './earlyHints';
import { offlineDataOf } from './tests/offlineData';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';

import type { SSRServer } from '../../types';
import type { IncomingHttpHeaders } from 'node:http';

/**
 * What a page loads, said before it is rendered — over real HTTP, where a 103 is a response of its own the client hears
 * before the page.
 */

const PORT = await unusedPort();
// A published revision beside the draft: its pages are kept, and a kept page is answered without a render.
const PUBLISHED_PORT = await unusedPort();
let server: SSRServer;
let published: SSRServer;

/** The interim responses and the final one of a GET of `path`. */
const get = (path: string, headers: Record<string, string> = {}, port = PORT) =>
  new Promise<{ hints: IncomingHttpHeaders[]; status: number; headers: IncomingHttpHeaders }>((resolve, reject) => {
    const hints: IncomingHttpHeaders[] = [];
    const req = request({ host: '127.0.0.1', port, path, headers }, res => {
      res.resume();
      res.on('end', () => {
        resolve({ hints, status: res.statusCode ?? 0, headers: res.headers });
      });
    });
    req.on('information', info => {
      if (info.statusCode === 103) {
        hints.push(info.headers);
      }
    });
    req.on('error', reject);
    req.end();
  });

beforeAll(async () => {
  server = createServer({ port: PORT, devMode: true, adapters: createJsonAdapters({ offlineData: offlineDataOf() }) });
  published = createServer({
    port: PUBLISHED_PORT,
    adapters: createJsonAdapters({
      offlineData: offlineDataOf(),
      deployment: { spaceId: 1, environment: 'production', revision: 1 }
    })
  });
  await Promise.all([server.listen(PORT, '127.0.0.1'), published.listen(PUBLISHED_PORT, '127.0.0.1')]);
  await vi.waitFor(async () => {
    expect((await get('/')).status).toBe(200);
  });
});

afterAll(async () => {
  await Promise.all([server.close(), published.close()]);
});

describe('modules/ssr/earlyHints', () => {
  it('says what the page loads in a 103 before the page, and again on the page for a CDN to keep', async () => {
    const { hints, status, headers } = await get('/');

    expect(status).toBe(200);
    expect(hints).toHaveLength(1);
    expect(hints[0].link).toContain('rel=preload; as=style');
    expect(headers.link).toBe(hints[0].link);
    // And Chromium is asked for the machine's scheme, which a `system` theme is drawn by from the next request on.
    expect(headers['accept-ch']).toBe('Sec-CH-Prefers-Color-Scheme');
    expect(headers.vary).toContain('Sec-CH-Prefers-Color-Scheme');

    // Compressed, it varies by the encoding as well — said beside the hint, not over it.
    const compressed = await get('/', { 'accept-encoding': 'br' });
    expect(compressed.headers['content-encoding']).toBe('br');
    expect(compressed.headers.vary?.split(', ')).toEqual(['Sec-CH-Prefers-Color-Scheme', 'Accept-Encoding']);
  });

  // Answered at once, a kept page has no wait to spend: a 103 before it was one more write for every page served.
  it('sends no 103 before a kept page, and keeps the Link a CDN answers hints from', async () => {
    const rendered = await get('/?hints=kept', {}, PUBLISHED_PORT);
    expect(rendered.headers['x-cache']).toBe('MISS');
    expect(rendered.hints).toHaveLength(1);

    const kept = await get('/?hints=kept', {}, PUBLISHED_PORT);
    expect(kept.headers['x-cache']).toBe('HIT');
    expect(kept.hints).toEqual([]);
    expect(kept.headers.link).toBe(rendered.hints[0].link);
  });

  // The SDK is asked once the page has painted: a hint for it shared a phone's network with the stylesheets.
  it('hints only what the first paint waits for: the stylesheets, never the SDK', () => {
    expect(pageLinks({}).every(link => link.endsWith('rel=preload; as=style'))).toBe(true);
    expect(pageLinks({}).some(link => link.includes('plitzi-sdk.js'))).toBe(false);
  });
});
