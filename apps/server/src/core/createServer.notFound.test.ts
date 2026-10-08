import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';

import { createServer } from './createServer';
import { unusedPort } from './unusedPort';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { Element, Schema, SSRServer } from '@plitzi/sdk-shared';

/**
 * An address that shows nothing answers 404, never a page that says "not found" with a 200 a crawler indexes: one no
 * page answers — with the space's own page for it, `slug: '*'` — and one whose server provider says its answer is
 * nothing (`notFound`). Neither is kept in the page cache, which an address asked for at random would fill.
 */

const PORT = await unusedPort();
const BASE = `http://127.0.0.1:${PORT}`;

const node = (id: string, type: string, rootId: string, items: string[] = [], parentId?: string): Element => ({
  id,
  attributes: {},
  definition: { type, label: id, rootId, items, styleSelectors: { base: '' }, ...(parentId ? { parentId } : {}) }
});

const schema: Schema = {
  ...EMPTY_SCHEMA.schema,
  flat: {
    home: { ...node('home', 'page', 'home'), attributes: { name: 'Home', slug: '', folder: '', default: true } },
    lost: { ...node('lost', 'page', 'lost', ['lost-text']), attributes: { name: 'Lost', slug: '*', folder: '' } },
    'lost-text': { ...node('lost-text', 'text', 'lost', [], 'lost'), attributes: { content: 'Nothing on this shelf' } },
    post: { ...node('post', 'page', 'post', ['post-data']), attributes: { name: 'Post', slug: 'p/:slug', folder: '' } },
    'post-data': {
      ...node('post-data', 'apiContainer', 'post', [], 'post'),
      attributes: {
        query: '/data/posts.json',
        notFound: '{{ source.data|filter(p => p.slug == navigation.routeParams.slug)|length == 0 }}'
      },
      definition: { ...node('post-data', 'apiContainer', 'post', [], 'post').definition, runtime: 'server' }
    },
    // The page says it itself, over a provider with no `notFound` of its own — as one in a layout, shared by pages.
    tag: {
      ...node('tag', 'page', 'tag', ['tag-data']),
      attributes: {
        name: 'Tag',
        slug: 't/:slug',
        folder: '',
        notFound: '{{ not (apiContainer_tag-data.data|find("slug", navigation.routeParams.slug)) }}',
        seoEnabled: true,
        seoPageTitle:
          '{{ (apiContainer_tag-data.data|find("slug", navigation.routeParams.slug)).name|default("No tag") }}'
      }
    },
    'tag-data': {
      ...node('tag-data', 'apiContainer', 'tag', [], 'tag'),
      attributes: { query: '/data/tags.json' },
      definition: { ...node('tag-data', 'apiContainer', 'tag', [], 'tag').definition, runtime: 'server' }
    }
  },
  pages: ['home', 'lost', 'post', 'tag'],
  rsc: { enabled: true }
};

let base: string;
let server: SSRServer;

beforeAll(async () => {
  base = mkdtempSync(path.join(tmpdir(), 'plitzi-not-found-'));
  mkdirSync(path.join(base, 'data'), { recursive: true });
  writeFileSync(path.join(base, 'data/posts.json'), JSON.stringify([{ slug: 'here' }]));
  writeFileSync(path.join(base, 'data/tags.json'), JSON.stringify([{ slug: 'ops', name: 'Operations' }]));

  server = createServer({
    port: PORT,
    // Published, so the page cache is on: what it keeps is part of what is asserted.
    adapters: createJsonAdapters({
      offlineData: { schema, style: EMPTY_STYLE_SCHEMA },
      deployment: { spaceId: 1, environment: 'production', revision: 0 }
    }),
    publicDir: base
  });
  await server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
  rmSync(base, { recursive: true, force: true });
});

describe('an address that shows nothing', () => {
  it('answers 404 with the space’s own page for it, where no page answers — never kept in the cache', async () => {
    const first = await fetch(`${BASE}/nope`, { redirect: 'manual' });
    const again = await fetch(`${BASE}/nope`, { redirect: 'manual' });

    expect(first.status).toBe(404);
    expect(await first.text()).toContain('Nothing on this shelf');
    expect([again.status, again.headers.get('x-cache')]).toEqual([404, 'MISS']);
  });

  it('answers 404 where a server provider says its answer is nothing, the page rendered as written', async () => {
    const found = await fetch(`${BASE}/p/here`);
    const gone = await fetch(`${BASE}/p/gone`);

    expect(found.status).toBe(200);
    expect(gone.status).toBe(404);
    expect(await gone.text()).toContain('data-plitzi-el="post"');
  });

  it('answers 404 where the page says so over its server providers, and titles the record it shows', async () => {
    const found = await fetch(`${BASE}/t/ops`);
    const gone = await fetch(`${BASE}/t/nothing`);

    expect(found.status).toBe(200);
    expect(await found.text()).toContain('<title>Operations</title>');
    expect(gone.status).toBe(404);
    expect(await gone.text()).toContain('<title>No tag</title>');
  });
});
