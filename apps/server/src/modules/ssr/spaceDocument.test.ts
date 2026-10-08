import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { offlineDataOf } from './testing/offlineData';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';
import { unusedPort } from '../../core/unusedPort';

import type { SSRServer } from '@plitzi/sdk-shared';

/**
 * The space beside the page, over real HTTP: the page names it and leaves it out of its payload, and the name answers
 * with the space — kept for good, because it is the name of that text and of no other.
 */

const PORT = await unusedPort();
const base = `http://127.0.0.1:${String(PORT)}`;

const offlineData = offlineDataOf();

let server: SSRServer;

const documentPath = (html: string): string | undefined => /<link id="plitzi-space" href="([^"]+)"/.exec(html)?.[1];

const payloadOf = (html: string): Record<string, unknown> =>
  JSON.parse(/id="plitzi-ssr-data">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{}') as Record<string, unknown>;

beforeAll(async () => {
  server = createServer({ port: PORT, devMode: true, adapters: createJsonAdapters({ offlineData }) });
  await server.listen(PORT, '127.0.0.1');

  await vi.waitFor(async () => {
    expect((await fetch(`${base}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('modules/ssr/spaceDocument', () => {
  it('names the space in the page, and leaves it out of the payload', async () => {
    const html = await (await fetch(`${base}/`)).text();

    expect(documentPath(html)).toMatch(/^\/_plitzi\/space\/[\w-]+\.json$/);
    expect(payloadOf(html)).not.toHaveProperty('offlineData');
    expect(html).toContain('as="fetch" crossorigin="anonymous"');
  });

  it('answers the name with the space, to be kept for good', async () => {
    const html = await (await fetch(`${base}/`)).text();
    const response = await fetch(`${base}${documentPath(html) ?? ''}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await response.json()).toEqual(offlineData);
  });

  it('answers a name that is not the space’s with the space as it is, kept by nobody', async () => {
    const response = await fetch(`${base}/_plitzi/space/not-this-one.json`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(offlineData);
  });

  // A host serving many spaces is asked for one by its token: the document must name the same space the page did, or
  // the host's own space answers it and another space's document is hydrated over this page.
  it('names the space with the token the page was asked for it with', async () => {
    const html = await (await fetch(`${base}/?access-token=a.b%2Bc`)).text();
    const path = documentPath(html) ?? '';

    expect(path).toMatch(/^\/_plitzi\/space\/[\w-]+\.json\?access-token=a\.b%2Bc$/);
    expect(await (await fetch(`${base}${path}`)).json()).toEqual(offlineData);
  });

  it('answers no other address under its own', async () => {
    expect((await fetch(`${base}/_plitzi/space/a/b.json`)).status).toBe(404);
  });
});
