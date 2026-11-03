import { request } from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { pageLinks } from './earlyHints';
import { offlineDataOf } from './tests/offlineData';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';
import { unusedPort } from '../../core/unusedPort';

import type { SSRServer } from '@plitzi/sdk-shared';
import type { IncomingHttpHeaders } from 'node:http';

/**
 * What a page loads, said before it is rendered — over real HTTP, where a 103 is a response of its own the client hears
 * before the page.
 */

const PORT = await unusedPort();
let server: SSRServer;

/** The interim responses and the final one of a GET of `path`. */
const get = (path: string, headers: Record<string, string> = {}) =>
  new Promise<{ hints: IncomingHttpHeaders[]; status: number; headers: IncomingHttpHeaders }>((resolve, reject) => {
    const hints: IncomingHttpHeaders[] = [];
    const req = request({ host: '127.0.0.1', port: PORT, path, headers }, res => {
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
  await server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await get('/')).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('modules/ssr/earlyHints', () => {
  it('says what the page loads in a 103 before the page, and again on the page for a CDN to keep', async () => {
    const { hints, status, headers } = await get('/');

    expect(status).toBe(200);
    expect(hints).toHaveLength(1);
    expect(hints[0].link).toContain('rel=preload; as=style');
    expect(hints[0].link).toContain('/sdk-assets/plitzi-sdk.js');
    expect(headers.link).toBe(hints[0].link);
    // And Chromium is asked for the machine's scheme, which a `system` theme is drawn by from the next request on.
    expect(headers['accept-ch']).toBe('Sec-CH-Prefers-Color-Scheme');
    expect(headers.vary).toContain('Sec-CH-Prefers-Color-Scheme');

    // Compressed, it varies by the encoding as well — said beside the hint, not over it.
    const compressed = await get('/', { 'accept-encoding': 'br' });
    expect(compressed.headers['content-encoding']).toBe('br');
    expect(compressed.headers.vary?.split(', ')).toEqual(['Sec-CH-Prefers-Color-Scheme', 'Accept-Encoding']);
  });

  // A module is fetched in CORS mode: a hint without `crossorigin` is a second request for the same file.
  it('hints the SDK as the module the page imports, and nothing of it to a page with no script', () => {
    expect(pageLinks({}).find(link => link.includes('plitzi-sdk.js'))).toMatch(/rel=preload; as=script; crossorigin$/);
    expect(pageLinks({ ssrOnly: true }).some(link => link.includes('plitzi-sdk.js'))).toBe(false);
  });
});
