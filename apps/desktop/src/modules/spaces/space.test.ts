import { describe, expect, it } from 'vitest';

import { byName, toSpace } from './space';

import type { SpaceRow } from './space';

const row = (overrides: Partial<SpaceRow> = {}): SpaceRow => ({
  id: 3,
  name: 'Fieldnotes',
  permanentUrl: 'fieldnotes',
  type: 'website',
  createdAt: '2026-01-02T00:00:00.000Z',
  category: { name: 'Blog' },
  workspace: { id: 9, name: 'Acme' },
  ...overrides
});

describe('a space, as the desktop reads it', () => {
  it('takes the fields the app shows', () => {
    expect(toSpace(row())).toEqual({
      id: 3,
      name: 'Fieldnotes',
      permanentUrl: 'fieldnotes',
      type: 'website',
      category: 'Blog',
      workspaceId: 9,
      workspaceName: 'Acme',
      createdAt: '2026-01-02T00:00:00.000Z'
    });
  });

  /**
   * Prisma answers a missing relation as `null`, and `null` reaches a `?.` guard as a value. Every optional field
   * is normalised to `undefined` here so no component has to test for both.
   */
  it('reads an absent relation as absent, not as null', () => {
    const space = toSpace(row({ category: null, workspace: null, type: null, createdAt: null }));

    expect(space).toEqual({
      id: 3,
      name: 'Fieldnotes',
      permanentUrl: 'fieldnotes',
      type: undefined,
      category: undefined,
      workspaceId: undefined,
      workspaceName: undefined,
      createdAt: undefined
    });
  });

  it('orders by name', () => {
    const names = [row({ id: 1, name: 'Zebra' }), row({ id: 2, name: 'Anvil' })].map(toSpace).sort(byName);

    expect(names.map(space => space.name)).toEqual(['Anvil', 'Zebra']);
  });

  it('breaks a tie on the id, so the list never reshuffles between reads', () => {
    const tied = [row({ id: 8, name: 'Same' }), row({ id: 2, name: 'Same' })].map(toSpace).sort(byName);

    expect(tied.map(space => space.id)).toEqual([2, 8]);
  });
});
