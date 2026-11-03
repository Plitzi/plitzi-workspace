import { createServer as createHttpServer } from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style';

import { createServer } from './createServer';
import { unusedPort } from './unusedPort';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { Element, Schema, SSRServer } from '@plitzi/sdk-shared';
import type { Server } from 'node:http';

/**
 * A server provider that asks the deployment's own API as the visitor: the page arrives with that visitor's data, read
 * with their session, from where the server reaches the API — and is kept for nobody, published or not.
 */

const PORT = await unusedPort();
const API_PORT = await unusedPort();
const BASE = `http://127.0.0.1:${PORT}`;
const API = 'https://api.example.test';

const node = (id: string, type: string, items: string[] = [], parentId?: string): Element => ({
  id,
  attributes: {},
  definition: {
    type,
    label: id,
    rootId: 'home',
    items,
    styleSelectors: { base: '' },
    ...(parentId ? { parentId } : {})
  }
});

const schema: Schema = {
  ...EMPTY_SCHEMA.schema,
  flat: {
    home: { ...node('home', 'page', ['me']), attributes: { name: 'Home', slug: '', folder: '', default: true } },
    me: {
      ...node('me', 'apiContainer', [], 'home'),
      attributes: { query: `${API}/me`, credentials: 'include' },
      definition: { ...node('me', 'apiContainer', [], 'home').definition, runtime: 'server' }
    }
  },
  pages: ['home'],
  rsc: { enabled: true }
};

let api: Server;
let server: SSRServer;
const asked: { cookie?: string; host?: string; proto?: string | string[] }[] = [];

beforeAll(async () => {
  api = createHttpServer((req, res) => {
    asked.push({ cookie: req.headers.cookie, host: req.headers.host, proto: req.headers['x-forwarded-proto'] });
    const session = /session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ name: session ? `ana-${session}` : 'stranger' }));
  });
  await new Promise<void>(resolve => api.listen(API_PORT, '127.0.0.1', resolve));

  server = createServer({
    port: PORT,
    // Published, so the page cache is on: that it keeps nothing is part of what is asserted.
    adapters: createJsonAdapters({
      offlineData: { schema, style: EMPTY_STYLE_SCHEMA },
      deployment: { spaceId: 1, environment: 'production', revision: 0 }
    }),
    rsc: {
      visitorCredentials: {
        origins: [API],
        via: { [API]: `http://127.0.0.1:${String(API_PORT)}` },
        cookies: ['session']
      }
    }
  });
  await server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/`)).status).toBe(200);
  });
  asked.length = 0;
});

afterAll(async () => {
  await server.close();
  await new Promise(resolve => api.close(resolve));
});

describe('a server provider asking as the visitor', () => {
  // Reached on this server's network, addressed as the public edge delivers it: what the API names the session by.
  it('draws the page with the visitor’s own data, read with their session alone from where the API is reached', async () => {
    const page = await fetch(`${BASE}/`, { headers: { cookie: 'session=s1; theme=dark' } });

    expect(await page.text()).toContain('ana-s1');
    expect(asked).toEqual([{ cookie: 'session=s1', host: 'api.example.test', proto: 'https' }]);
  });

  it('keeps the page for nobody: the next visitor, and the same one a moment later, are read again', async () => {
    const first = await fetch(`${BASE}/`, { headers: { cookie: 'session=s2' } });
    const again = await fetch(`${BASE}/`, { headers: { cookie: 'session=s2' } });
    const other = await fetch(`${BASE}/`, { headers: { cookie: 'session=s3' } });

    expect(first.headers.get('x-cache')).toBe('MISS');
    expect(again.headers.get('x-cache')).toBe('MISS');
    expect(await other.text()).toContain('ana-s3');
  });
});
