import { describe, expect, it } from 'vitest';

import { descendants, parentChain, renderContext } from './elementTree';

import type { Schema } from '@plitzi/sdk-shared';

const node = (
  id: string,
  type: string,
  parentId: string | undefined,
  rootId: string,
  attributes: Record<string, unknown> = {},
  items: string[] = []
): Schema['flat'][string] => ({
  id,
  attributes,
  definition: { label: id, type, parentId, rootId, items, styleSelectors: { base: '' } }
});

/** A page shown in a layout that is itself shown in another: `map` renders inside both shells. */
const flat: Schema['flat'] = {
  shell: node('shell', 'layoutContainer', undefined, 'shell', {}, ['shell-body', 'shell-header']),
  'shell-body': node('shell-body', 'container', 'shell', 'shell'),
  'shell-header': node('shell-header', 'apiContainer', 'shell', 'shell'),
  analytics: node(
    'analytics',
    'layoutContainer',
    undefined,
    'analytics',
    {
      layout: 'shell',
      layoutContainer: 'shell-body'
    },
    ['analytics-api']
  ),
  'analytics-api': node('analytics-api', 'apiContainer', 'analytics', 'analytics', {}, ['analytics-body']),
  'analytics-body': node('analytics-body', 'container', 'analytics-api', 'analytics'),
  audience: node(
    'audience',
    'page',
    undefined,
    'audience',
    {
      layout: 'analytics',
      layoutContainer: 'analytics-body'
    },
    ['map']
  ),
  map: node('map', 'container', 'audience', 'audience')
};

describe('parentChain', () => {
  it('climbs the stored tree, nearest first, without crossing into a layout', () => {
    expect(parentChain(flat, 'analytics-body')).toEqual(['analytics-api', 'analytics']);
    expect(parentChain(flat, 'map')).toEqual(['audience']);
    expect(parentChain(flat, 'audience')).toEqual([]);
  });

  it('survives a parent that is gone and a cycle two editors left behind', () => {
    expect(parentChain({ ...flat, map: node('map', 'container', 'ghost', 'audience') }, 'map')).toEqual([]);

    const cyclic = { ...flat, a: node('a', 'container', 'b', 'x'), b: node('b', 'container', 'a', 'x') };
    expect(parentChain(cyclic, 'a')).toEqual(['b']);
  });
});

describe('renderContext', () => {
  // A page's content binds to a provider its SHELL holds, so the shell — and the one around it — are around it.
  it('walks from a page into its shell and on into the shell around that', () => {
    expect(new Set(renderContext(flat, 'map'))).toEqual(
      new Set(['audience', 'analytics-body', 'analytics-api', 'analytics', 'shell-body', 'shell'])
    );
  });

  // Beside the slot rather than around it: the runtime never hands its source to the page.
  it('leaves out a provider elsewhere in the layout', () => {
    expect(renderContext(flat, 'map')).not.toContain('shell-header');
  });

  it('stops at shells that name each other', () => {
    const cyclic: Schema['flat'] = {
      ...flat,
      shell: node('shell', 'layoutContainer', undefined, 'shell', {
        layout: 'analytics',
        layoutContainer: 'analytics-body'
      })
    };

    expect(() => renderContext(cyclic, 'map')).not.toThrow();
  });
});

describe('descendants', () => {
  it('lists everything under an element, depth first, skipping items that name nothing', () => {
    const withGhost = {
      ...flat,
      'analytics-api': node('analytics-api', 'apiContainer', 'analytics', 'analytics', {}, ['analytics-body', 'ghost'])
    };

    expect(descendants(withGhost, 'analytics')).toEqual(['analytics-api', 'analytics-body']);
    expect(descendants(flat, 'map')).toEqual([]);
  });
});
