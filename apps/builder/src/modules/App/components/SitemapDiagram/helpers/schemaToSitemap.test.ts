import { describe, expect, it } from 'vitest';

import schemaToSitemap from './schemaToSitemap';
import searchSitemap from './searchSitemap';

import type { Element, PageFolder } from '@plitzi/sdk-shared';

const page = (id: string, attributes: Record<string, unknown>, flag?: Element['definition']['flag']): Element => ({
  id,
  attributes: { name: id, slug: id, ...attributes },
  definition: { label: id, type: 'page', rootId: id, styleSelectors: { base: '' }, ...(flag ? { flag } : {}) }
});

const folders: PageFolder[] = [{ id: 'shop', name: 'Shop', slug: 'shop', parentId: '' }];

describe('schemaToSitemap', () => {
  it('reads who may open a page as the page decides it: unset is anyone, public only guests', () => {
    const entries = schemaToSitemap(
      [page('open', {}), page('login', { accessLevel: 'public' }), page('account', { accessLevel: 'authenticated' })],
      []
    );

    expect(entries.map(entry => entry.type === 'page' && entry.access)).toEqual(['signedIn', 'guests', 'everyone']);
  });

  it('nests pages in their folder under its address, and names their layout, flag and redirect', () => {
    const [shop] = schemaToSitemap(
      [
        page(
          'cart',
          { folder: 'shop', layout: 'main-layout', layoutContainer: 'main-slot' },
          { name: 'newCart', is: true }
        ),
        page('orders', {
          folder: 'shop',
          accessLevel: 'authenticated',
          unauthorizedBehaviour: 'redirect',
          unauthorizedPageRedirect: 'cart'
        })
      ],
      folders,
      { 'main-layout': 'Main' }
    );

    expect(shop).toMatchObject({ type: 'folder', path: '/shop' });
    expect(shop.type === 'folder' && shop.children).toEqual([
      expect.objectContaining({ id: 'cart', path: '/shop/cart', layout: 'Main', flag: { name: 'newCart', is: true } }),
      expect.objectContaining({ id: 'orders', redirectTo: 'cart' })
    ]);
  });
});

describe('searchSitemap', () => {
  it('finds by name or address, and keeps the folders leading to a match lit', () => {
    const entries = schemaToSitemap([page('cart', { folder: 'shop' }), page('home', {})], folders);

    const found = searchSitemap(entries, 'CART');
    expect(found.matches).toEqual(['cart']);
    expect([...found.visible]).toEqual(['cart', 'shop']);
    expect(searchSitemap(entries, '  ').matches).toEqual([]);
  });
});
