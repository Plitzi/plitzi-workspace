import { describe, expect, it } from 'vitest';

import { freeSlugFor, isNotFoundPage, notFoundPageIn, slugOfName } from './notFoundPages';

import type { Element } from '../types';

const page = (id: string, attributes: Record<string, unknown>): Element => ({
  id,
  attributes,
  definition: { rootId: id, label: id, type: 'page', items: [], styleSelectors: { base: '' } }
});

const space = (...list: Element[]) => ({
  flat: Object.fromEntries(list.map(each => [each.id, each])),
  pages: list.map(each => each.id)
});

describe('the page for the addresses nothing answers, one per place', () => {
  const pages = space(
    page('home', { name: 'Home', slug: '' }),
    page('lost', { name: 'Not found', slug: '*' }),
    page('docs-lost', { name: 'Docs not found', slug: '*', folder: 'docs' }),
    page('not-found-old', { name: 'Old', slug: 'not-found' })
  );

  it('is the page whose slug is *, in the place asked about', () => {
    expect(isNotFoundPage({ slug: '*' })).toBe(true);
    expect(isNotFoundPage({ slug: 'blog/*' })).toBe(false);
    expect(notFoundPageIn(pages, '')).toBe('lost');
    expect(notFoundPageIn(pages, 'docs')).toBe('docs-lost');
    expect(notFoundPageIn(pages, 'blog')).toBeUndefined();
    expect(notFoundPageIn(pages, '', 'lost')).toBeUndefined();
  });

  it('gives a page that stops being one a slug of its name nobody beside it has', () => {
    expect(slugOfName(' Not   found! ')).toBe('not-found');
    expect(freeSlugFor(pages, 'lost')).toBe('not-found-2');
    expect(freeSlugFor(pages, 'docs-lost')).toBe('docs-not-found');
  });
});
