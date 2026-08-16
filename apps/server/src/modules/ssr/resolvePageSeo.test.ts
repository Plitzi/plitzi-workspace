import { describe, expect, it } from 'vitest';

import { resolvePageSeo } from './resolvePageSeo';

import type { Element, Schema } from '@plitzi/sdk-shared';

const page = (id: string, attributes: Record<string, unknown>): Element => ({
  id,
  attributes,
  definition: { type: 'page', label: id, rootId: id, items: [], styleSelectors: { base: '' } }
});

const schema = (pages: Record<string, Element>): Schema => ({
  flat: pages,
  pages: Object.keys(pages),
  pageFolders: [],
  definition: { name: 'test', permanentUrl: 'test' },
  variables: [],
  settings: { customCss: '' }
});

describe('resolvePageSeo', () => {
  it('reads the title and description the page declares', () => {
    const s = schema({
      home: page('home', { seoEnabled: true, seoPageTitle: 'Café Mirabel', seoPageDescription: 'A small kitchen.' })
    });

    expect(resolvePageSeo(s, 'home')).toEqual({ title: 'Café Mirabel', description: 'A small kitchen.' });
  });

  it('says nothing for a page that turned SEO off, so the deployment default stays in charge', () => {
    const s = schema({ home: page('home', { seoEnabled: false, seoPageTitle: 'Ignored' }) });

    expect(resolvePageSeo(s, 'home')).toEqual({});
  });

  it('treats a blank field as absent — an empty title is worse than a generic one', () => {
    const s = schema({ home: page('home', { seoEnabled: true, seoPageTitle: '   ', seoPageDescription: '' }) });

    expect(resolvePageSeo(s, 'home')).toEqual({});
  });

  it('returns each half independently', () => {
    const s = schema({ home: page('home', { seoEnabled: true, seoPageDescription: 'Only this.' }) });

    expect(resolvePageSeo(s, 'home')).toEqual({ description: 'Only this.' });
  });

  it('says nothing when the URL matched no page, or there is no schema', () => {
    const s = schema({ home: page('home', { seoEnabled: true, seoPageTitle: 'Home' }) });

    expect(resolvePageSeo(s, undefined)).toEqual({});
    expect(resolvePageSeo(s, 'missing')).toEqual({});
    expect(resolvePageSeo(undefined, 'home')).toEqual({});
  });
});
