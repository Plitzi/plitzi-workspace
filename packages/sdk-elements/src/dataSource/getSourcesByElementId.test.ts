import { describe, it, expect, vi } from 'vitest';

import getSourcesByElementId from './getSourcesByElementId';

import type { Schema, Source } from '@plitzi/sdk-shared';

// The ancestry walk is exercised elsewhere (FlatMap.parentTree); here it's stubbed so the source-visibility
// filtering is tested in isolation. `child` sees `parent`; anything else sees no ancestors.
vi.mock('@plitzi/sdk-schema/helpers/FlatMap', () => ({
  default: { parentTree: (_flat: unknown, id: string) => (id === 'child' ? ['parent'] : []) }
}));

const flat = { child: {}, parent: {} } as unknown as Schema['flat'];

const source = (id: string, ownerId: string): Source => ({
  id,
  meta: { id: ownerId, name: id, source: id, fields: [] }
});

describe('getSourcesByElementId', () => {
  it('returns {} when id or schemaFlat is missing', () => {
    expect(getSourcesByElementId({}, flat, undefined)).toEqual({});
    expect(getSourcesByElementId({}, undefined, 'child')).toEqual({});
  });

  it('includes global sources regardless of ancestry', () => {
    const sources = { g: source('g', 'global') };

    expect(getSourcesByElementId(sources, flat, 'child')).toEqual(sources);
  });

  it('includes sources owned by an ancestor container', () => {
    const sources = { s1: source('s1', 'parent') };

    expect(getSourcesByElementId(sources, flat, 'child')).toEqual(sources);
  });

  it('excludes sources owned by unrelated elements', () => {
    const sources = { s1: source('s1', 'stranger') };

    expect(getSourcesByElementId(sources, flat, 'child')).toEqual({});
  });

  it('merges globals with ancestor-owned sources and drops the rest', () => {
    const sources = {
      g: source('g', 'global'),
      owned: source('owned', 'parent'),
      other: source('other', 'stranger')
    };

    const result = getSourcesByElementId(sources, flat, 'child');

    expect(Object.keys(result).sort()).toEqual(['g', 'owned']);
  });

  it('tolerates a source with no meta.id (skipped, not thrown)', () => {
    const sources = { g: source('g', 'global'), anon: { id: 'anon', meta: { name: 'anon' } } as Source };

    expect(getSourcesByElementId(sources, flat, 'child')).toEqual({ g: sources.g });
  });
});
