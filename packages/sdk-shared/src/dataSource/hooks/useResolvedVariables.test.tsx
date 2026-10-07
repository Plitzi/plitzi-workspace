import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import useResolvedVariables from './useResolvedVariables';

import type { ReactNode } from 'react';

const wrapper =
  (value: Record<string, unknown>) =>
  ({ children }: { children?: ReactNode }) =>
    createElement(StoreProvider<Record<string, unknown>>, { value }, children);

const variables = [
  { name: 'brand', category: 'color', type: 'color', value: '#4f46e5', subValues: [] },
  {
    name: 'apiUrl',
    category: 'general',
    type: 'text',
    value: 'https://api.example.com',
    subValues: [
      {
        when: { combinator: 'and', rules: [{ field: 'hostname', operator: '=', value: 'shop.plitzi.local' }] },
        value: 'https://api.plitzi.local'
      }
    ]
  }
];

describe('useResolvedVariables', () => {
  // What renders above the provider that publishes them — the SDK's own stylesheet — reads them the same on the server
  // and in the browser: nothing has to have been published first.
  it('resolves the space’s variables from the document, with nothing published', () => {
    const { result } = renderHook(() => useResolvedVariables(), {
      wrapper: wrapper({
        schema: { variables },
        navigation: { hostname: 'shop.example.com' },
        runtime: { sources: {} }
      })
    });

    expect(result.current).toEqual({ brand: '#4f46e5', apiUrl: 'https://api.example.com' });
  });

  it('takes the value whose rule the visitor’s host matches', () => {
    const { result } = renderHook(() => useResolvedVariables(), {
      wrapper: wrapper({
        schema: { variables },
        navigation: { hostname: 'shop.plitzi.local' },
        runtime: { sources: {} }
      })
    });

    expect(result.current.apiUrl).toBe('https://api.plitzi.local');
  });

  it('keeps the same object while what it resolves to does not change', () => {
    const { result, rerender } = renderHook(() => useResolvedVariables(), {
      wrapper: wrapper({
        schema: { variables },
        navigation: { hostname: 'shop.example.com' },
        runtime: { sources: {} }
      })
    });
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});
