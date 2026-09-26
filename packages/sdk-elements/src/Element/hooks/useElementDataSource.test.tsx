import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';

import useElementDataSource from './useElementDataSource';

import type { ElementBinding } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const makeWrapper =
  (storeValue: Record<string, unknown>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(StoreProvider, { value: storeValue }, children);

const variablesBinding: ElementBinding[] = [{ id: 'b1', source: 'variables.title', to: 'text', enabled: true }];

const thumbnailBinding: ElementBinding[] = [
  {
    id: 'b2',
    source: 'list_spaces.item.id',
    to: 'src',
    enabled: true,
    transformers: [{ action: 'twigTemplate', params: { template: '/thumb/{{source}}?theme={{ theme.resolved }}' } }]
  }
];

describe('useElementDataSource (subscribes to referenced `runtime.sources.*`)', () => {
  it('reads a source referenced by a binding', () => {
    const { result } = renderHook(() => useElementDataSource({ bindings: { attributes: variablesBinding } }), {
      wrapper: makeWrapper({ runtime: { sources: { variables: { title: 'Hi' } } } })
    });

    expect(result.current.variables).toEqual({ title: 'Hi' });
  });

  it('reads the sources passed explicitly via `sources`', () => {
    const { result } = renderHook(() => useElementDataSource({ sources: ['variables', 'navigation'] }), {
      wrapper: makeWrapper({
        runtime: { sources: { variables: { a: 1 }, navigation: { routeParams: {}, queryParams: {} } } }
      })
    });

    const map = result.current;

    expect(map.variables).toEqual({ a: 1 });
    expect(map.navigation).toEqual({ routeParams: {}, queryParams: {} });
  });

  it('returns only the referenced sources, not unrelated ones in the slice', () => {
    const { result } = renderHook(() => useElementDataSource({ bindings: { attributes: variablesBinding } }), {
      wrapper: makeWrapper({
        runtime: { sources: { variables: { title: 'Hi' }, auth: { isAuthenticated: true } } }
      })
    });

    const map = result.current;

    expect(map.variables).toEqual({ title: 'Hi' });
    expect(map.auth).toBeUndefined();
  });

  /** The regression: a binding on a list row whose template also named the theme got nothing for the theme. */
  it('reads the sources its twigTemplate names, not only the one in `source`', () => {
    const { result } = renderHook(() => useElementDataSource({ bindings: { attributes: thumbnailBinding } }), {
      wrapper: makeWrapper({
        runtime: { sources: { list_spaces: { item: { id: 7 } }, theme: { mode: 'dark', resolved: 'dark' } } }
      })
    });

    expect(result.current.list_spaces).toEqual({ item: { id: 7 } });
    // The path the template reads, not the whole source it sits in.
    expect(result.current.theme).toEqual({ resolved: 'dark' });
  });

  /** `{{source}}` is the bound value: a key for it in this map, even an undefined one, would shadow it in the template. */
  it('leaves out a name that resolves to no source rather than setting it to undefined', () => {
    const { result } = renderHook(() => useElementDataSource({ bindings: { attributes: thumbnailBinding } }), {
      wrapper: makeWrapper({ runtime: { sources: { list_spaces: { item: { id: 7 } } } } })
    });

    expect(Object.hasOwn(result.current, 'source')).toBe(false);
    expect(Object.hasOwn(result.current, 'theme')).toBe(false);
  });

  /**
   * Subscribed by path, not by source: every element on a page reads some computed value, and subscribed to the whole
   * of `computed` each one rendered again whenever any computed value changed.
   */
  it('renders again only when a path it reads changes', () => {
    const binding: ElementBinding[] = [{ id: 'b3', source: 'computed.tool', to: 'label', enabled: true }];
    const store = createStore<{ runtime: { sources: Record<string, unknown> } }>({
      runtime: { sources: { computed: { tool: 'pen', count: 1 } } }
    });
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;

        return useElementDataSource({ bindings: { attributes: binding } });
      },
      { wrapper: ({ children }: { children: ReactNode }) => <StoreProvider store={store}>{children}</StoreProvider> }
    );
    const before = renders;

    act(() => store.setState('runtime.sources.computed', { tool: 'pen', count: 2 }));

    expect(renders).toBe(before);
    expect(result.current.computed).toEqual({ tool: 'pen' });

    act(() => store.setState('runtime.sources.computed', { tool: 'laser', count: 2 }));

    expect(result.current.computed).toEqual({ tool: 'laser' });
  });

  /** A binding shown only while a rule holds is told when what the rule reads changes. */
  it('reads the fields its `when` compares', () => {
    const binding: ElementBinding[] = [
      {
        id: 'b4',
        source: 'variables.title',
        to: 'text',
        enabled: true,
        when: { combinator: 'and', rules: [{ field: 'state.open', operator: '=', value: true }] }
      }
    ];
    const { result } = renderHook(() => useElementDataSource({ bindings: { attributes: binding } }), {
      wrapper: makeWrapper({ runtime: { sources: { variables: { title: 'Hi' }, state: { open: true, other: 1 } } } })
    });

    expect(result.current.state).toEqual({ open: true });
  });

  it('returns an empty map when nothing is referenced', () => {
    const { result } = renderHook(() => useElementDataSource({ bindings: {}, sources: [] }), {
      wrapper: makeWrapper({ runtime: { sources: { variables: { a: 1 } } } })
    });

    expect(result.current).toEqual({});
  });
});
