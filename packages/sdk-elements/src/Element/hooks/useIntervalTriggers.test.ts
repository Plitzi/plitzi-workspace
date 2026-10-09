import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useIntervalTriggers from './useIntervalTriggers';

import type { InteractionsManagerApi } from '@plitzi/sdk-shared';
import type { ElementInteraction } from '@plitzi/sdk-shared';

const trigger = (id: string, interval: number | string, enabled = true): ElementInteraction => ({
  id,
  title: 'On Interval',
  type: 'trigger',
  action: 'onInterval',
  params: { interval },
  preview: {},
  elementId: 'el1',
  beforeNode: '',
  afterNode: '',
  flowId: id,
  enabled
});

const fired = vi.fn<(id: string, action: string, payload: unknown) => Promise<void>>();
// The hook calls one method of the manager; the rest of it has nothing to do with clocks.
const manager = { interactionTrigger: fired } as unknown as InteractionsManagerApi;

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useIntervalTriggers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fired.mockReset();
    fired.mockResolvedValue(undefined);
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mount = (interactions: Record<string, ElementInteraction>, previewMode = true) =>
    renderHook(() => useIntervalTriggers({ id: 'el1', interactions, previewMode, interactionsManager: manager }));

  it('ticks each interval on its own clock, counting its own ticks', () => {
    mount({ a: trigger('a', 1000), b: trigger('b', '2500') });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const ticks = fired.mock.calls.map(([, , payload]) => payload);
    expect(ticks.filter(tick => (tick as { interval: number }).interval === 1000)).toHaveLength(5);
    expect(ticks).toContainEqual({ interval: 2500, count: 2 });
  });

  it('stands still while the tab is hidden, and carries on once it is back', () => {
    mount({ a: trigger('a', 1000) });

    setVisibility('hidden');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fired).not.toHaveBeenCalled();

    setVisibility('visible');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fired).toHaveBeenCalledWith('el1', 'onInterval', { interval: 1000, count: 1 });
  });

  it('does not tick in the builder outside preview, nor for a disabled flow or one below the floor', () => {
    mount({ a: trigger('a', 1000) }, false);
    mount({ b: trigger('b', 1000, false), c: trigger('c', 50) });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(fired).not.toHaveBeenCalled();
  });

  it('stops when the element goes', () => {
    const { unmount } = mount({ a: trigger('a', 1000) });
    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(fired).not.toHaveBeenCalled();
  });
});
