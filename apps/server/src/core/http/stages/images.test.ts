import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { imagesPathOf } from './images';
import { createJsonAdapters } from '../../../adapters/jsonAdapters';
import { offlineDataOf } from '../../../modules/ssr/testing/offlineData';
import { createServer } from '../../createServer';
import { unusedPort } from '../../unusedPort';

import type { SSRServer } from '@plitzi/sdk-shared';

/**
 * `/_plitzi/img` over real HTTP, through the pipeline a deployment gets: mounted only where `images` is configured,
 * and refusing — before anything is fetched — what it must not fetch. What it does with a picture it may fetch is
 * `modules/images`'s, tested there with no network.
 */

const PORT = await unusedPort();
const BARE_PORT = await unusedPort();
const base = (port: number) => `http://127.0.0.1:${String(port)}`;

const offlineData = offlineDataOf();

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-image-stage-'));

let server: SSRServer;
let bare: SSRServer;

const image = (query: string, port = PORT, init?: RequestInit) => fetch(`${base(port)}/_plitzi/img?${query}`, init);

beforeAll(async () => {
  server = createServer({
    port: PORT,
    devMode: true,
    images: { domains: ['images.example.com'], cacheDir },
    adapters: createJsonAdapters({ offlineData })
  });
  bare = createServer({ port: BARE_PORT, devMode: true, adapters: createJsonAdapters({ offlineData }) });
  await server.listen(PORT, '127.0.0.1');
  await bare.listen(BARE_PORT, '127.0.0.1');

  await vi.waitFor(async () => {
    expect((await image('w=1')).status).toBe(400);
  });
});

afterAll(async () => {
  await server.close();
  await bare.close();
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

describe('core/http/stages/images', () => {
  it('is published, and answers, only where the deployment configured it', async () => {
    expect(imagesPathOf({ images: { domains: ['images.example.com'] } })).toBe('/_plitzi/img');
    expect(imagesPathOf({ images: { domains: [] } })).toBeUndefined();
    expect(imagesPathOf({})).toBeUndefined();
    expect(
      (await image('url=https%3A%2F%2Fimages.example.com%2Fa.jpg&w=640', BARE_PORT)).headers.get('content-type')
    ).toContain('text/html');
  });

  it('refuses a host it was not given, a width it does not make and a write, fetching nothing', async () => {
    const outbound = vi.spyOn(globalThis, 'fetch');
    const foreign = await image('url=https%3A%2F%2Fevil.test%2Fa.jpg&w=640');
    const width = await image('url=https%3A%2F%2Fimages.example.com%2Fa.jpg&w=641');
    const post = await image('url=x&w=640', PORT, { method: 'POST' });

    expect([foreign.status, width.status, post.status]).toEqual([403, 400, 405]);
    expect(await width.text()).toContain('320, 480, 640');
    // The three requests above are this test's own; the server made none of its own.
    expect(outbound).toHaveBeenCalledTimes(3);
    outbound.mockRestore();
  });
});
