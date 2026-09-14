import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect } from 'vitest';

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
    expect(result.current.theme).toEqual({ mode: 'dark', resolved: 'dark' });
  });

  /** `{{source}}` is the bound value: a key for it in this map, even an undefined one, would shadow it in the template. */
  it('leaves out a name that resolves to no source rather than setting it to undefined', () => {
    const { result } = renderHook(() => useElementDataSource({ bindings: { attributes: thumbnailBinding } }), {
      wrapper: makeWrapper({ runtime: { sources: { list_spaces: { item: { id: 7 } } } } })
    });

    expect(Object.hasOwn(result.current, 'source')).toBe(false);
    expect(Object.hasOwn(result.current, 'theme')).toBe(false);
  });

  it('returns an empty map when nothing is referenced', () => {
    const { result } = renderHook(() => useElementDataSource({ bindings: {}, sources: [] }), {
      wrapper: makeWrapper({ runtime: { sources: { variables: { a: 1 } } } })
    });

    expect(result.current).toEqual({});
  });
});
