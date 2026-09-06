import { describe, expect, it } from 'vitest';

import elementsByRoot from './elementsByRoot';

import type { Element } from '@plitzi/sdk-shared';

/** A flat map where each entry names the root it lives under, the way the store really holds it. */
const flat = (entries: [id: string, rootId: string, name?: string][]): Record<string, Element> =>
  Object.fromEntries(
    entries.map(([id, rootId, name]) => [
      id,
      { id, attributes: name ? { name } : {}, definition: { rootId, label: id } } as unknown as Element
    ])
  );

describe('elementsByRoot — the live element count, by the page that holds it', () => {
  // A grouping, not a second measurement: whatever it says has to add up to the number in the header.
  it('adds up to the element count exactly, heaviest page first', () => {
    const schema = flat([
      ['home', 'home', 'Home'],
      ['hero', 'home'],
      ['pricing', 'pricing', 'Pricing'],
      ['table', 'pricing'],
      ['row', 'pricing']
    ]);

    const rows = elementsByRoot(schema);

    expect(rows.reduce((total, row) => total + row.elements, 0)).toBe(Object.keys(schema).length);
    expect(rows).toEqual([
      { page: 'Pricing', elements: 3 },
      { page: 'Home', elements: 2 }
    ]);
  });

  // A layout's elements are authored once and rendered by every page that uses it; sharing them out would report a
  // total that no page actually has.
  it('lists a layout as itself rather than splitting it over the pages inside it', () => {
    expect(
      elementsByRoot(
        flat([
          ['layout', 'layout'],
          ['sidebar', 'layout'],
          ['home', 'home', 'Home']
        ])
      )
    ).toEqual([
      { page: 'layout', elements: 2 },
      { page: 'Home', elements: 1 }
    ]);
  });

  it('falls back to the id when a root names nothing', () => {
    expect(elementsByRoot(flat([['orphan', 'missing-root']]))).toEqual([{ page: 'missing-root', elements: 1 }]);
  });

  it('has nothing to say about an empty schema', () => {
    expect(elementsByRoot({})).toEqual([]);
  });
});
