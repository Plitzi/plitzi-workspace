// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';

import FreshnessPanel from './FreshnessPanel';

import type { DevStoreEntry } from '@plitzi/nexus';

let uid = 0;
const makeEntry = (name: string): DevStoreEntry => ({
  uid: String(++uid),
  name,
  scopeId: 'sdk',
  store: createStore<Record<string, unknown>>({})
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FreshnessPanel', () => {
  it('renders nothing while no store holds a TTL', () => {
    const { container } = render(<FreshnessPanel entries={[makeEntry('root'), makeEntry('Queries')]} />);

    expect(container.innerHTML).toBe('');
  });

  it('lists each path with a TTL and counts it down to stale', () => {
    const entry = makeEntry('Queries');
    entry.store.setState('orders', [1], { ttl: 3_000 });
    render(<FreshnessPanel entries={[entry]} />);

    expect(screen.getByText('orders')).toBeTruthy();
    expect(screen.getByText('3s left')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('stale')).toBeTruthy();
  });

  /** The TTL lives in the query cache while the reader is looking at a provider's scope — it must show regardless. */
  it('shows the TTLs of every store, whichever one they are in', () => {
    const scope = makeEntry('Api:an-api');
    const queries = makeEntry('Queries');
    render(<FreshnessPanel entries={[scope, queries]} />);

    act(() => {
      queries.store.setState('entries', { x: 1 }, { ttl: 60_000 });
    });

    expect(screen.getByText('Queries')).toBeTruthy();
    expect(screen.getByText('entries')).toBeTruthy();
  });

  it('expires a path, or every path of every store, from its buttons', () => {
    const first = makeEntry('root');
    const second = makeEntry('Queries');
    first.store.setState('orders', [1], { ttl: 60_000 });
    second.store.setState('users', [1], { ttl: 60_000 });
    const expired = vi.fn();
    first.store.watchFreshness(event => {
      expired(event.type, event.path);
    });
    render(<FreshnessPanel entries={[first, second]} />);

    const ordersRow = screen.getByText('orders').closest('li');
    expect(ordersRow).not.toBeNull();
    fireEvent.click(within(ordersRow ?? document.body).getByText('Expire'));
    expect(expired).toHaveBeenLastCalledWith('expired', 'orders');
    expect(second.store.isStale('users')).toBe(false);

    fireEvent.click(screen.getByText('Expire all'));
    expect(second.store.isStale('users')).toBe(true);
    expect(screen.getAllByText('stale')).toHaveLength(2);
  });
});
