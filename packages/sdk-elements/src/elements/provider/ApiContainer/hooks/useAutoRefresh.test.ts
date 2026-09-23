import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useAutoRefresh from './useAutoRefresh';

import type { UseAutoRefreshParams } from './useAutoRefresh';

const setVisibility = (state: DocumentVisibilityState) =>
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('refreshes once per interval', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh({ seconds: 2, enabled: true, refresh }));

    await vi.advanceTimersByTimeAsync(6_000);

    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('accepts the interval as the text the builder stores', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh({ seconds: '1', enabled: true, refresh }));

    await vi.advanceTimersByTimeAsync(3_000);

    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it.each([0, -5, '', 'soon'])('never refreshes with an interval of %j', async seconds => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh({ seconds, enabled: true, refresh }));

    await vi.advanceTimersByTimeAsync(60_000);

    expect(refresh).not.toHaveBeenCalled();
  });

  it('never refreshes a provider that cannot fetch', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh({ seconds: 1, enabled: false, refresh }));

    await vi.advanceTimersByTimeAsync(10_000);

    expect(refresh).not.toHaveBeenCalled();
  });

  // A dashboard left in a background tab overnight is otherwise a request every few seconds answering nobody.
  it('does not ask while the tab is hidden, and resumes when it is shown', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh({ seconds: 1, enabled: true, refresh }));

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(5_000);

    expect(refresh).not.toHaveBeenCalled();

    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(1_000);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // On a slow server the interval outruns the answer; a second request on top of the first is how a poll piles up.
  it('never starts a refresh while the previous one is still running', async () => {
    let finish: () => void = () => undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    renderHook(() => useAutoRefresh({ seconds: 1, enabled: true, refresh }));

    await vi.advanceTimersByTimeAsync(5_000);

    expect(refresh).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps going after a refresh that failed', async () => {
    const refresh = vi.fn(() => Promise.reject(new Error('offline')));
    renderHook(() => useAutoRefresh({ seconds: 1, enabled: true, refresh }));

    await vi.advanceTimersByTimeAsync(3_000);

    expect(refresh).toHaveBeenCalledTimes(3);
  });

  // A parent re-render hands over a new callback; restarting the countdown on each one would mean a page that
  // re-renders often never refreshes at all.
  it('calls the newest callback without restarting the countdown', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook((params: UseAutoRefreshParams) => useAutoRefresh(params), {
      initialProps: { seconds: 2, enabled: true, refresh: first }
    });

    await vi.advanceTimersByTimeAsync(1_500);
    rerender({ seconds: 2, enabled: true, refresh: second });
    await vi.advanceTimersByTimeAsync(500);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops when the provider unmounts', async () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useAutoRefresh({ seconds: 1, enabled: true, refresh }));

    unmount();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(refresh).not.toHaveBeenCalled();
  });
});
