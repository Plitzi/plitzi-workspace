import { createServer as createHttpServer } from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style';

import { createServer } from './createServer';
import { unusedPort } from './unusedPort';
import { createJsonAdapters } from '../adapters/jsonAdapters';
import { serverLog } from '../helpers/serverLog';

import type { Element, Schema, SSRServer } from '@plitzi/sdk-shared';
import type { Server } from 'node:http';

/**
 * A space held to one render at a time (`renderLimit`) over real HTTP: a page of it that is never kept — the draft drawn
 * with what a slow provider answered — takes the turn, the next (another address) waits its time and is answered 503 with `Retry-After`,
 * and a kept page is served all the while, a kept page taking no turn.
 */

const PORT = await unusedPort();
const API_PORT = await unusedPort();
const BASE = `http://127.0.0.1:${PORT}`;
const API = `http://127.0.0.1:${API_PORT}`;

const node = (id: string, type: string, items: string[] = [], rootId = id, parentId?: string): Element => ({
  id,
  attributes: {},
  definition: { type, label: id, rootId, items, styleSelectors: { base: '' }, ...(parentId ? { parentId } : {}) }
});

const schema: Schema = {
  ...EMPTY_SCHEMA.schema,
  flat: {
    home: { ...node('home', 'page'), attributes: { name: 'Home', slug: '', folder: '', default: true } },
    data: { ...node('data', 'page', ['answer']), attributes: { name: 'Data', slug: 'data', folder: '' } },
    answer: {
      ...node('answer', 'apiContainer', [], 'data', 'data'),
      attributes: { query: `${API}/answer` },
      definition: { ...node('answer', 'apiContainer', [], 'data', 'data').definition, runtime: 'server' }
    }
  },
  pages: ['home', 'data'],
  rsc: { enabled: true }
};

let api: Server;
let server: SSRServer;

beforeAll(async () => {
  vi.spyOn(serverLog, 'warn').mockImplementation(() => undefined);
  api = createHttpServer((_req, res) => {
    setTimeout(() => {
      res.setHeader('Content-Type', 'application/json');
      res.end('{"ok":true}');
    }, 400);
  });
  await new Promise<void>(resolve => api.listen(API_PORT, '127.0.0.1', resolve));

  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({
      offlineData: { schema, style: EMPTY_STYLE_SCHEMA },
      deployment: { spaceId: 1, environment: 'main', revision: 0, draftVersion: 'v1', renderLimit: 1 }
    }),
    renderLimit: { waitMs: 50 },
    outbound: { privateOrigins: [API] }
  });
  await server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await server.close();
  await new Promise(resolve => api.close(resolve));
});

describe('a space held to one render at a time', () => {
  it('renders one page, answers the next busy, and serves a kept page meanwhile', async () => {
    await fetch(`${BASE}/`);
    const rendering = fetch(`${BASE}/data?x=1`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Another address: the same one would wait on that very render rather than ask a turn of its own.
    const busy = await fetch(`${BASE}/data?x=2`);
    const kept = await fetch(`${BASE}/`);

    expect(busy.status).toBe(503);
    expect(busy.headers.get('retry-after')).toBe('2');
    expect(busy.headers.get('cache-control')).toBe('no-store');
    expect(await busy.text()).toContain('This site is busy right now');
    expect(kept.status).toBe(200);
    expect(kept.headers.get('x-cache')).toBe('HIT');
    expect((await rendering).status).toBe(200);
  });

  it('renders again once the turn is given back', async () => {
    expect((await fetch(`${BASE}/data`)).status).toBe(200);
  });
});
