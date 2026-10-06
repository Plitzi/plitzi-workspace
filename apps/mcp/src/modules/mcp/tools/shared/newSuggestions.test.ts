import { describe, expect, it } from 'vitest';

import { authorSpace, heading } from '@plitzi/sdk-authoring';

import { newSuggestions } from './newSuggestions';

import type { Space } from '../../helpers';
import type { SpaceSpec } from '@plitzi/sdk-authoring';

const spaceWith = (classes: SpaceSpec['classes']): Space => {
  const { schema, style } = authorSpace({
    name: 'New',
    permanentUrl: 'new',
    classes: { title: {}, ...classes },
    pages: [{ name: 'Home', slug: '', body: [heading({ content: 'Hello', class: 'title' })] }]
  });

  return { schema, style, connectors: [], actions: [] };
};

describe('newSuggestions', () => {
  it('says a class a batch left unused, though the space already had another', () => {
    const lines = newSuggestions(spaceWith({ old: {} }), spaceWith({ old: {}, fresh: {} }));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[unused-class\].*`fresh`/);
  });

  it('says nothing when the batch left the unused ones as they were, or took one away', () => {
    expect(newSuggestions(spaceWith({ old: {} }), spaceWith({ old: {} }))).toEqual([]);
    expect(newSuggestions(spaceWith({ old: {}, fresh: {} }), spaceWith({ old: {} }))).toEqual([]);
  });
});
