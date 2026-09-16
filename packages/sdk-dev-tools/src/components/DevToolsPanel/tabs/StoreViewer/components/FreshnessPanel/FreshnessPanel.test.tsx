// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';

import FreshnessPanel from './FreshnessPanel';

import type { DevStore } from '@plitzi/nexus';

const makeStore = () => createStore<Record<string, unknown>>({}) as DevStore;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FreshnessPanel', () => {
  it('renders nothing for a store without TTLs', () => {
    const { container } = render(<FreshnessPanel store={makeStore()} />);

    expect(container.innerHTML).toBe('');
  });

  it('lists each path with a TTL and counts it down to stale', () => {
    const store = makeStore();
    store.setState('orders', [1], { ttl: 3_000 });
    render(<FreshnessPanel store={store} />);

    expect(screen.getByText('orders')).toBeTruthy();
    expect(screen.getByText('3s left')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('stale')).toBeTruthy();
  });

  it('expires a path, or all of them, from its buttons', () => {
    const store = makeStore();
    store.setState('orders', [1], { ttl: 60_000 });
    store.setState('users', [1], { ttl: 60_000 });
    const expired = vi.fn();
    store.watchFreshness(event => {
      expired(event.type, event.path);
    });
    render(<FreshnessPanel store={store} />);

    fireEvent.click(screen.getAllByText('Expire')[0]);
    expect(expired).toHaveBeenLastCalledWith('expired', 'orders');
    expect(store.isStale('users')).toBe(false);

    fireEvent.click(screen.getByText('Expire all'));
    expect(store.isStale('users')).toBe(true);
    expect(screen.getAllByText('stale')).toHaveLength(2);
  });
});
