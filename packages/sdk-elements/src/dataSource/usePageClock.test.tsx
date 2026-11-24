import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import usePageClock, { dayOf, minuteOf } from './usePageClock';

import type { ReactNode } from 'react';

const DRAWN = Date.UTC(2026, 10, 24, 9, 41, 30);

const clockOf = (clock?: { at: number; simulated?: boolean }) =>
  renderHook(() => usePageClock(), {
    wrapper: ({ children }: { children: ReactNode }) => <StoreProvider value={{ clock }}>{children}</StoreProvider>
  });

describe('usePageClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DRAWN + 5000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the minute the server drew the page at, and moves on at each minute’s turn', () => {
    const { result } = clockOf({ at: DRAWN });

    expect(result.current).toBe(Date.UTC(2026, 10, 24, 9, 41));

    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    expect(result.current).toBe(Date.UTC(2026, 10, 24, 9, 42));
  });

  it('keeps the minute the builder simulates', () => {
    const simulated = Date.UTC(2026, 11, 1, 9, 0);
    const { result } = clockOf({ at: simulated, simulated: true });

    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });

    expect(result.current).toBe(simulated);
  });

  it('says the minute and the day an instant is in, the day in UTC', () => {
    expect(minuteOf(DRAWN)).toBe(Date.UTC(2026, 10, 24, 9, 41));
    expect(dayOf(Date.UTC(2026, 10, 24, 23, 59))).toBe('2026-11-24');
  });
});
