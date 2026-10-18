import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useElementSize from './useElementSize';

type Observed = (entries: { contentRect: { width: number; height: number } }[]) => void;

const observers: Observed[] = [];

class FakeResizeObserver {
  constructor(callback: Observed) {
    observers.push(callback);
  }

  observe = vi.fn();

  disconnect = vi.fn();
}

afterEach(() => {
  observers.length = 0;
  vi.unstubAllGlobals();
});

describe('useElementSize', () => {
  it('measures the element, and follows it as it is resized', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const node = document.createElement('div');
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ width: 744, height: 900 } as DOMRect);

    const ref = { current: node };
    const { result } = renderHook(() => useElementSize(ref));
    expect(result.current).toEqual({ width: 744, height: 900 });

    act(() => observers[0]([{ contentRect: { width: 1024, height: 700 } }]));
    expect(result.current).toEqual({ width: 1024, height: 700 });
  });

  /** On the server, and wherever nothing is there to measure: undefined, as in the first render, so hydration matches. */
  it('answers nothing it cannot measure', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const ref = { current: null };
    expect(renderHook(() => useElementSize(ref)).result.current).toBeUndefined();
  });
});
