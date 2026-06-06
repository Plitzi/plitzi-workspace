import { renderHook, act } from '@testing-library/react';
import { createElement, useContext } from 'react';
import { describe, it, expect } from 'vitest';

import { cascade } from './middleware/cascade';
import { loggerMiddleware } from './middleware/loggerMiddleware';
import StoreProvider, { StoreContext } from './StoreProvider';

import type { StoreApi } from './types';
import type { ReactNode } from 'react';

type S = { n: number };

const useInnerStore = () => useContext(StoreContext) as StoreApi<S>;

describe('StoreProvider — middleware inheritance', () => {
  it('a cascade() middleware set on the root is inherited by a nested provider', () => {
    const paths: (string | undefined)[] = [];
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        StoreProvider<S>,
        {
          value: { n: 0 },
          autoSync: false,
          middlewares: [cascade(loggerMiddleware<S>(change => paths.push(change.path)))]
        },
        createElement(StoreProvider<S>, { value: { n: 0 }, autoSync: false }, children)
      );

    const { result } = renderHook(useInnerStore, { wrapper });
    act(() => result.current.setState('n', 1));

    expect(paths).toEqual(['n']);
  });

  it('does not inherit a middleware that is not marked cascade()', () => {
    const paths: (string | undefined)[] = [];
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        StoreProvider<S>,
        { value: { n: 0 }, autoSync: false, middlewares: [loggerMiddleware<S>(change => paths.push(change.path))] },
        createElement(StoreProvider<S>, { value: { n: 0 }, autoSync: false }, children)
      );

    const { result } = renderHook(useInnerStore, { wrapper });
    act(() => result.current.setState('n', 1));

    expect(paths).toEqual([]);
  });
});
