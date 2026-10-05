import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';

import { createServer } from './createServer';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { Schema, SSRServer } from '@plitzi/sdk-shared';

/**
 * A project with no backend: its data is a file in `public/`, read by a server provider. The page has to arrive with
 * that data in it — the sections, and the anchors in them — rather than fetch it once the browser has the page.
 */

const PORT = 39314;
const DATA_PORT = 39315;
const BASE = `http://127.0.0.1:${PORT}`;
const TITLE = 'Hello from public/data';

const schema: Schema = {
  ...EMPTY_SCHEMA.schema,
  flat: {
    home: {
      id: 'home',
      attributes: { name: 'Home', slug: '', folder: '', default: true },
      definition: { type: 'page', label: 'home', rootId: 'home', items: ['site'], styleSelectors: { base: '' } }
    },
    site: {
      id: 'site',
      attributes: { query: '/data/home.json' },
      definition: {
        type: 'apiContainer',
        label: 'site',
        rootId: 'home',
        parentId: 'home',
        items: [],
        styleSelectors: { base: '' },
        runtime: 'server'
      }
    }
  },
  pages: ['home'],
  rsc: { enabled: true }
};

let base: string;
let server: SSRServer;

beforeAll(async () => {
  base = mkdtempSync(path.join(tmpdir(), 'plitzi-public-data-'));
  mkdirSync(path.join(base, 'data'), { recursive: true });
  writeFileSync(path.join(base, 'data/home.json'), JSON.stringify({ hero: { title: TITLE } }));

  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({ offlineData: { schema, style: EMPTY_STYLE_SCHEMA } }),
    publicDir: base
  });
  server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/_rsc?location=/&ids=site`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
  rmSync(base, { recursive: true, force: true });
});

describe('createServer with public data', () => {
  it('resolves a server provider reading one of its own files, with no connector or action configured', async () => {
    const payload = await (await fetch(`${BASE}/_rsc?location=/&ids=site`)).text();

    expect(payload).toContain(TITLE);
    // The body under `data`, as a browser request publishes it: a binding reads `site.data.hero` in either runtime.
    expect(payload).toContain('"data":{"hero":{"title"');
  });

  it('renders the page with that data already in it', async () => {
    const html = await (await fetch(`${BASE}/`)).text();

    expect(html).toContain(TITLE);
  });

  it('still serves the file itself, for a provider that reads it in the browser', async () => {
    expect(await (await fetch(`${BASE}/data/home.json`)).json()).toEqual({ hero: { title: TITLE } });
  });
});

describe('createServer with the project’s own data', () => {
  const DATA_BASE = `http://127.0.0.1:${DATA_PORT}`;
  let dataDir: string;
  let dataServer: SSRServer;

  beforeAll(async () => {
    dataDir = mkdtempSync(path.join(tmpdir(), 'plitzi-data-dir-'));
    writeFileSync(path.join(dataDir, 'home.json'), JSON.stringify({ hero: { title: TITLE }, cost: 'internal' }));
    dataServer = createServer({
      port: DATA_PORT,
      adapters: createJsonAdapters({ offlineData: { schema, style: EMPTY_STYLE_SCHEMA } }),
      dataDir
    });
    dataServer.listen(DATA_PORT, '127.0.0.1');
    await vi.waitFor(async () => {
      expect((await fetch(`${DATA_BASE}/_rsc?location=/&ids=site`)).status).toBe(200);
    });
  });

  afterAll(async () => {
    await dataServer.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('renders the page with a file of `dataDir` in it, read as `/data/<file>`', async () => {
    expect(await (await fetch(`${DATA_BASE}/`)).text()).toContain(TITLE);
  });

  it('never serves the file: its path is a page’s, like any other the space does not have', async () => {
    const answer = await fetch(`${DATA_BASE}/data/home.json`);

    expect(answer.headers.get('content-type')).toContain('text/html');
    expect(await answer.text()).toMatch(/^<!doctype html>/);
  });
});
