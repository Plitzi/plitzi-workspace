import { describe, expect, it } from 'vitest';

import { pathOf } from './helpers';

import type { Element } from '@plitzi/sdk-shared';

// What the path reads of an element and nothing else: a whole `Element` would be a page of fields no step looks at.
const element = (id: string, label: string, parentId?: string): Element =>
  ({ id, attributes: {}, definition: { type: 'container', label, parentId, items: [] } }) as unknown as Element;

const flat = {
  page: element('page', 'Home'),
  hero: element('hero', 'Hero', 'page'),
  title: element('title', 'Title', 'hero')
};

describe('the way to an element', () => {
  it('is every step from the root, in order', () => {
    expect(pathOf(flat, 'title').map(step => step.label)).toEqual(['Home', 'Hero', 'Title']);
  });

  it('is nothing for no element, and one unknown step for an id the document lacks', () => {
    expect(pathOf(flat)).toEqual([]);
    expect(pathOf(flat, 'gone')).toEqual([{ id: 'gone', label: 'unknown', type: 'unknown' }]);
  });
});
