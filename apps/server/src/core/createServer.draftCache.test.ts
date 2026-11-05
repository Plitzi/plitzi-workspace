import { createServer as createHttpServer } from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { unusedPort } from '@plitzi/sdk-kernel/http';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style';

import { createServer } from './createServer';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { SSRServer } from '../types';
import type { Element, Schema } from '@plitzi/sdk-shared';
import type { Server } from 'node:http';

/**
 * The draft (`main`) over real HTTP, for a deployment that says what it is at (`draftVersion`): a page of it is kept under
 * that version — the next visitor is handed it — but never one drawn with what its server providers answered, which
 * the draft, being developed, never keeps.
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
let answered = 0;

beforeAll(async () => {
  api = createHttpServer((_req, res) => {
    answered++;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ n: answered }));
  });
  await new Promise<void>(resolve => api.listen(API_PORT, '127.0.0.1', resolve));

  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({
      offlineData: { schema, style: EMPTY_STYLE_SCHEMA },
      deployment: { spaceId: 1, environment: 'main', revision: 0, draftVersion: 'v1' }
    }),
    // The provider's API is on this machine: reached as a deployment's own would be.
    outbound: { privateOrigins: [API] }
  });
  await server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
  await new Promise(resolve => api.close(resolve));
});

describe('a draft whose version the deployment says', () => {
  it('keeps its page for the next visitor', async () => {
    await fetch(`${BASE}/`);
    const again = await fetch(`${BASE}/`);

    expect(again.headers.get('x-cache')).toBe('HIT');
  });

  it('never keeps a page drawn with what its server providers answered', async () => {
    const first = await fetch(`${BASE}/data`);
    const again = await fetch(`${BASE}/data`);

    expect(first.status).toBe(200);
    expect(again.headers.get('x-cache')).toBe('MISS');
    expect(answered).toBeGreaterThanOrEqual(2);
  });
});
