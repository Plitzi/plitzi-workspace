import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';

import SchemaContextProvider from './SchemaContextProvider';

import type { Element, Schema } from '@plitzi/sdk-shared';

/** What the provider publishes to the store, by key, as it publishes it. */
const published = new Map<string, unknown[]>();
vi.mock('@plitzi/sdk-shared/store', () => ({
  useSdkStoreSync: (key: string, value: unknown) => {
    published.set(key, [...(published.get(key) ?? []), value]);
  }
}));

const element = (id: string, slug: string): Element => ({
  id,
  attributes: { slug },
  definition: { rootId: id, label: id, type: 'page', items: [], styleSelectors: { base: '' } }
});

const schemaOf = (flat: Record<string, Element>, pages: string[]): Schema => ({ ...EMPTY_SCHEMA.schema, flat, pages });

const lastPages = (): Record<string, Element> => {
  const all = published.get('pageDefinitions') ?? [];

  return all[all.length - 1] as Record<string, Element>;
};

/**
 * The routes are built from the pages' own elements. An edit to one page — its slug, its flag — makes a new `flat`
 * and leaves `pages` the same array, as an edit made with Immer does: the routes kept the page's old address.
 */
describe('SchemaContextProvider — the pages the routes are built from', () => {
  it('follows an edit to a page, and keeps the same object for an edit anywhere else', () => {
    const pages = ['home'];
    const first = schemaOf({ home: element('home', '/'), hero: element('hero', '') }, pages);
    const { rerender } = render(<SchemaContextProvider schema={first}>page</SchemaContextProvider>);
    const before = lastPages();
    expect(before.home.attributes.slug).toBe('/');

    rerender(
      <SchemaContextProvider schema={schemaOf({ ...first.flat, hero: element('hero', 'changed') }, pages)}>
        page
      </SchemaContextProvider>
    );
    expect(lastPages()).toBe(before);

    rerender(
      <SchemaContextProvider schema={schemaOf({ ...first.flat, home: element('home', '/start') }, pages)}>
        page
      </SchemaContextProvider>
    );
    expect(lastPages().home.attributes.slug).toBe('/start');
  });
});
