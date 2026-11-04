import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style';

import { createServer } from './createServer';
import { unusedPort } from './unusedPort';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { Element, Schema, SSRServer } from '@plitzi/sdk-shared';

/**
 * What a link preview reads of a page — a chat's card, a post — is the document as the server sends it: it never runs
 * the page. A link to a space pasted in a chat showed no picture, Plitzi's icon and `lang="en"` whatever the space was.
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
  settings: {
    ...EMPTY_SCHEMA.schema.settings,
    siteName: 'Acme',
    language: 'es-MX',
    favicon: '/favicon.svg',
    shareImage: '/og.png',
    themeColor: { light: '#fbf7f0', dark: '#0b0a10' }
  },
  flat: {
    home: {
      ...node('home', 'page', 'home'),
      attributes: {
        name: 'Home',
        slug: '',
        folder: '',
        default: true,
        seoEnabled: true,
        seoPageTitle: 'Listen together'
      }
    },
    room: {
      ...node('room', 'page', 'room', ['room-data']),
      attributes: {
        name: 'Room',
        slug: 'r/:slug',
        folder: '',
        seoEnabled: true,
        seoType: 'music.playlist',
        seoPageTitle: '{{ (apiContainer_room-data.data|find("slug", navigation.routeParams.slug)).name }}',
        seoImage: '/covers/{{ navigation.routeParams.slug }}.png',
        seoImageAlt: 'The cover of {{ navigation.routeParams.slug }}'
      }
    },
    'room-data': {
      ...node('room-data', 'apiContainer', 'room', [], 'room'),
      attributes: { query: '/data/rooms.json' },
      definition: { ...node('room-data', 'apiContainer', 'room', [], 'room').definition, runtime: 'server' }
    }
  },
  pages: ['home', 'room'],
  rsc: { enabled: true }
};

let base: string;
let server: SSRServer;

beforeAll(async () => {
  base = mkdtempSync(path.join(tmpdir(), 'plitzi-head-'));
  mkdirSync(path.join(base, 'data'), { recursive: true });
  writeFileSync(path.join(base, 'data/rooms.json'), JSON.stringify([{ slug: 'jazz', name: 'Late Night Jazz' }]));
  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({ offlineData: { schema, style: EMPTY_STYLE_SCHEMA } }),
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

describe('the head a link preview reads', () => {
  it('says the page’s picture whole, a large card, its kind, its address, the site, its language and icon', async () => {
    const html = await (await fetch(`${BASE}/r/jazz?ref=discord`)).text();

    expect(html).toContain('<html lang="es-MX"');
    expect(html).toContain('<title>Late Night Jazz</title>');
    expect(html).toContain(`<meta property="og:image" content="${BASE}/covers/jazz.png" />`);
    expect(html).toContain('<meta property="og:image:alt" content="The cover of jazz" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('<meta property="og:type" content="music.playlist" />');
    expect(html).toContain(`<meta property="og:url" content="${BASE}/r/jazz" />`);
    expect(html).toContain(`<link rel="canonical" href="${BASE}/r/jazz" />`);
    expect(html).toContain('<meta property="og:site_name" content="Acme" />');
    expect(html).toContain('<meta property="og:locale" content="es_MX" />');
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    expect(html).toContain('<meta name="theme-color" content="#0b0a10" media="(prefers-color-scheme: dark)" />');
    expect(html).not.toContain('cdn.plitzi.com/resources/img/favicon.svg');
  });

  // A space that names no icon is given Plitzi's from its own origin: asked of Plitzi's CDN, another site, the browser
  // sent that site's cookies along (Lighthouse's "Uses third-party cookies").
  it('serves Plitzi’s icon from the page’s own origin, as an SVG', async () => {
    const icon = await fetch(`${BASE}/_plitzi/favicon.svg`);

    expect(icon.status).toBe(200);
    expect(icon.headers.get('content-type')).toBe('image/svg+xml');
    expect(await icon.text()).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect((await fetch(`${BASE}/_plitzi/favicon.svg`, { method: 'POST' })).status).toBe(405);
  });

  // Lighthouse's "Ensure CSP is effective against XSS", reported for now: the template's scripts carry the render's nonce.
  it('says its script policy, naming the nonce its own scripts carry, new on every render', async () => {
    const nonceOf = async () => {
      const response = await fetch(`${BASE}/r/jazz?u=${String(Math.random())}`);
      const policy = response.headers.get('content-security-policy-report-only') ?? '';
      const html = await response.text();
      const nonce = /'nonce-([^']+)'/.exec(policy)?.[1] ?? '';

      expect(policy).toContain("'strict-dynamic'");
      expect(html).toContain(`<script type="module" nonce="${nonce}">`);

      return nonce;
    };

    expect(await nonceOf()).not.toBe(await nonceOf());
  });

  it('takes the reports a browser sends of what the policy would refuse', async () => {
    const report = {
      'csp-report': {
        'document-uri': `${BASE}/r/jazz`,
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'https://ads.example/tag.js'
      }
    };
    const sent = await fetch(`${BASE}/_plitzi/csp-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify(report)
    });

    expect(sent.status).toBe(204);
    expect((await fetch(`${BASE}/_plitzi/csp-report`, { method: 'POST', body: 'not json' })).status).toBe(400);
  });

  it('falls back to the space’s picture on a page that names none', async () => {
    const html = await (await fetch(`${BASE}/`)).text();

    expect(html).toContain(`<meta property="og:image" content="${BASE}/og.png" />`);
    expect(html).toContain('<meta property="og:type" content="website" />');
  });
});
