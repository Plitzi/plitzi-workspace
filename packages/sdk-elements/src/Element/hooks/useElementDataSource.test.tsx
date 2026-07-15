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

  it('returns an empty map when nothing is referenced', () => {
    const { result } = renderHook(() => useElementDataSource({ bindings: {}, sources: [] }), {
      wrapper: makeWrapper({ runtime: { sources: { variables: { a: 1 } } } })
    });

    expect(result.current).toEqual({});
  });
});
