// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useNarrowWindow, { SIDE_PANEL_WINDOW_MIN } from './useNarrowWindow';

afterEach(() => {
  vi.unstubAllGlobals();
});

// At 390 the side panel ran off the screen and covered the page whole.
describe('a window too narrow for the panel beside the page', () => {
  it('is followed as the window changes', () => {
    let width = 390;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === `(max-width: ${String(SIDE_PANEL_WINDOW_MIN - 1)}px)` && width < SIDE_PANEL_WINDOW_MIN;
      },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener)
    }));
    const { result, unmount } = renderHook(() => useNarrowWindow());
    expect(result.current).toBe(true);

    width = 1440;
    act(() => listeners.forEach(listener => listener()));
    expect(result.current).toBe(false);

    unmount();
    expect(listeners.size).toBe(0);
  });
});
