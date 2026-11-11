import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { unusedPort } from '@plitzi/sdk-kernel/http';

import { iconGlyphsAt } from './glyphs';
import { spaceIconsOf } from './spaceIcons';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';
import { resolveSdkAssetsDir } from '../../core/sdkAssets';
import { offlineDataOf, oneEmptyPage } from '../ssr/tests/offlineData';

import type { SSRServer } from '../../types';
import type { OfflineDataRaw, Schema } from '@plitzi/sdk-shared';

/**
 * A space's icons as faces of their own: the glyphs it names, cut from the whole font, declared after it in the head
 * and answered by any replica from the space. Plitzi's website names 110 glyphs: 9 KB, where the solid face is 119 KB.
 */

const SDK = resolveSdkAssetsDir();
if (!SDK) {
  throw new Error('The SDK is not installed: build apps/sdk, whose icon sheet and fonts these tests read');
}

const glyphs = iconGlyphsAt(SDK);

/** A page with an icon, a brand, and a binding that picks one of two at run time. */
const withIcons = (): Schema => ({
  ...oneEmptyPage,
  flat: {
    ...oneEmptyPage.flat,
    home: { ...oneEmptyPage.flat.home, definition: { ...oneEmptyPage.flat.home.definition, items: ['mark', 'menu'] } },
    mark: {
      id: 'mark',
      attributes: { icon: 'fas fa-check', social: 'fab fa-github' },
      definition: { type: 'text', label: 'mark', rootId: 'home', parentId: 'home', styleSelectors: { base: '' } }
    },
    menu: {
      id: 'menu',
      attributes: {},
      definition: {
        type: 'text',
        label: 'menu',
        rootId: 'home',
        parentId: 'home',
        styleSelectors: { base: '' },
        bindings: {
          attributes: [
            {
              id: 'menu-icon',
              to: 'icon',
              source: 'state.open',
              transformers: [
                { action: 'template', params: { template: "{{ value ? 'fas fa-xmark' : 'fas fa-bars' }}" } }
              ]
            }
          ]
        }
      }
    }
  }
});

describe('the glyphs the SDK draws', () => {
  it('are read off its icon sheet: each name, its face and its file', () => {
    expect(glyphs.codepoints.get('fa-check')).toBe(0xf00c);
    expect(glyphs.codepoints.get('fa-0')).toBe(0x30);
    expect(glyphs.brands.has('fa-github')).toBe(true);
    expect(glyphs.brands.has('fa-check')).toBe(false);
    expect(glyphs.faces.map(face => [face.key, face.file])).toEqual([
      ['solid', 'fa-solid-900.woff2'],
      ['regular', 'fa-regular-400.woff2'],
      ['brands', 'fa-brands-400.woff2']
    ]);
  });
});

describe('the icons a space names', () => {
  it('are every glyph its document names — a binding’s both sides too — each in its face', () => {
    const icons = spaceIconsOf(offlineDataOf(withIcons()), glyphs);

    expect(icons?.faces.map(face => [face.key, face.codepoints])).toEqual([
      ['solid', [0xf00c, 0xf0c9, 0xf00d].sort((a, b) => a - b)],
      ['brands', [0xf09b]]
    ]);
  });

  // The regular face is a few hundred glyphs: a space with one regular icon fetched its every solid glyph twice.
  it('puts an icon in the face its style class names, and none in another', () => {
    const schema = withIcons();
    schema.flat.mark.attributes.icon = "{{ liked ? 'far fa-heart' : 'fas fa-check' }}";
    const icons = spaceIconsOf(offlineDataOf(schema), glyphs);

    expect(icons?.faces.find(face => face.key === 'regular')?.codepoints).toEqual([0xf004]);
    expect(icons?.faces.find(face => face.key === 'solid')?.codepoints).not.toContain(0xf004);
  });

  it('are none for a space that names none', () => {
    expect(spaceIconsOf(offlineDataOf(), glyphs)).toBeUndefined();
  });
});

const PORT = await unusedPort();
const base = `http://127.0.0.1:${String(PORT)}`;
let offlineData: OfflineDataRaw = offlineDataOf(withIcons());
let server: SSRServer;

const facesOf = (html: string): string | undefined => /<style data-plitzi-icons>([^<]*)<\/style>/.exec(html)?.[1];

beforeAll(async () => {
  server = createServer({
    port: PORT,
    devMode: true,
    adapters: { ...createJsonAdapters({ offlineData }), getOfflineData: () => Promise.resolve(offlineData) }
  });
  await server.listen(PORT, '127.0.0.1');

  await vi.waitFor(async () => {
    expect((await fetch(`${base}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('a page’s icon faces', () => {
  it('are declared in the head after the whole font, each for the glyphs it holds', async () => {
    const html = await (await fetch(`${base}/`)).text();
    const faces = facesOf(html) ?? '';

    expect(html.indexOf('plitzi-sdk-icons.css')).toBeLessThan(html.indexOf('data-plitzi-icons'));
    expect(faces).toMatch(/font-weight:900;.*unicode-range:U\+F00C-F00D,U\+F0C9\}/);
    expect(faces).toContain('font-family:"Font Awesome 7 Brands"');
  });

  it('are answered with the glyphs alone, kept for good: a few kilobytes, not the whole face', async () => {
    const html = await (await fetch(`${base}/`)).text();
    const href = /src:url\((\/_plitzi\/icons\/[\w-]+-solid\.woff2)\)/.exec(facesOf(html) ?? '')?.[1] ?? '';
    const response = await fetch(`${base}${href}`);
    const font = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('font/woff2');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(font.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(font.length).toBeLessThan(15_000);
  });

  // The space changed after the page was drawn: its glyphs as they are now, kept by nobody.
  it('answers an older name with the space’s glyphs as they are, kept by nobody', async () => {
    const response = await fetch(`${base}/_plitzi/icons/aaaaaaaaaaaaaaaa-solid.woff2`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('says a face the space has none of is not there', async () => {
    const response = await fetch(`${base}/_plitzi/icons/aaaaaaaaaaaaaaaa-regular.woff2`);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Space 1 (main) names no regular icon');
  });

  // The token names a space other than the host's: its faces would be asked for by the host and cut from another.
  it('draws a page that named its space by a token from the whole font', async () => {
    expect(facesOf(await (await fetch(`${base}/?access-token=a.b`)).text())).toBeUndefined();
  });

  it('declares none for a space that names no icon', async () => {
    offlineData = offlineDataOf();
    try {
      expect(facesOf(await (await fetch(`${base}/`)).text())).toBeUndefined();
    } finally {
      offlineData = offlineDataOf(withIcons());
    }
  });
});
