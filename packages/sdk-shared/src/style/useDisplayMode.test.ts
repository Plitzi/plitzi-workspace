import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useDisplayMode from './useDisplayMode';

/** A viewport of a given width, as `matchMedia` answers the two `max-width` queries the hook asks. */
const viewport = (initial: number) => {
  let width = initial;
  const listeners = new Set<() => void>();
  const maxWidth = (query: string): number => Number(/max-width:\s*([\d.]+)rem/.exec(query)?.[1] ?? 0) * 16;

  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return width <= maxWidth(query);
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener)
    }) as unknown as MediaQueryList;

  return {
    resize: (next: number) => {
      width = next;
      listeners.forEach(listener => {
        listener();
      });
    },
    listeners
  };
};

describe('useDisplayMode', () => {
  it('names the breakpoint by the widths the space’s styles are compiled at', () => {
    const screen = viewport(1440);
    const { result } = renderHook(() => useDisplayMode());
    expect(result.current).toBe('desktop');

    act(() => screen.resize(1024));
    expect(result.current).toBe('tablet');

    act(() => screen.resize(768));
    expect(result.current).toBe('mobile');

    act(() => screen.resize(769));
    expect(result.current).toBe('tablet');
  });

  it('stops listening when the component leaves', () => {
    const screen = viewport(1440);
    const { unmount } = renderHook(() => useDisplayMode());
    expect(screen.listeners.size).toBeGreaterThan(0);

    unmount();

    expect(screen.listeners.size).toBe(0);
  });
});
