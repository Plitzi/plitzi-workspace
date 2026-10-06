import { describe, expect, it } from 'vitest';

import { groupByTree, usageCount, usageSummary } from './grouping';

import type { ElementUsage, UsageItem, UsageTree } from './usageIndex';

const home: UsageTree = { kind: 'page', id: 'home', label: 'Home' };
const card: UsageTree = { kind: 'component', id: 'card', label: 'Card' };
const usage = (elementId: string, tree: UsageTree): ElementUsage => ({
  elementId,
  elementType: 'container',
  tree,
  via: []
});

describe('usage grouping', () => {
  it('groups uses by the tree they are in, keeping the order the index found them', () => {
    const elements = [usage('a', home), usage('b', card), usage('c', home)];

    expect(groupByTree(elements).map(group => [group.tree.id, group.elements.map(entry => entry.elementId)])).toEqual([
      ['home', ['a', 'c']],
      ['card', ['b']]
    ]);
    expect(usageSummary(elements, [])).toBe('3 elements in 2 places');
    expect(usageSummary([usage('a', home)], [])).toBe('1 element in 1 place');
  });

  it('counts the other readers when no element uses the item', () => {
    const item: UsageItem = {
      key: 'token:color:accent',
      name: 'accent',
      detail: 'color',
      elements: [],
      references: [{ kind: 'selector', name: '.hero' }],
      unused: false
    };

    expect(usageCount(item)).toBe('1 ref');
    expect(usageCount({ ...item, elements: [usage('a', home)] })).toBe('1');
    expect(usageCount({ ...item, references: [] })).toBe('named');
  });
});
