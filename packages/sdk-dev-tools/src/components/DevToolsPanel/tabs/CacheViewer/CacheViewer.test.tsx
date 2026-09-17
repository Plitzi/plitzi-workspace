// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';

import CacheViewer from './CacheViewer';

import type { PathDescription } from '../../../../freshness';
import type { DevStoreEntry } from '@plitzi/nexus';

let uid = 0;
let stores: DevStoreEntry[] = [];

const makeEntry = (name: string): DevStoreEntry => {
  const entry = { uid: String(++uid), name, scopeId: 'sdk', store: createStore<Record<string, unknown>>({}) };
  stores.push(entry);

  return entry;
};

vi.mock('../../../../scope/useScope', () => ({ useInstanceStores: () => stores }));

const describe_ = vi.hoisted(() => vi.fn<() => PathDescription | undefined>(() => undefined));
const forget = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../../../freshness', async () => ({
  ...(await vi.importActual<object>('../../../../freshness')),
  describeQueryPath: (...args: unknown[]) => describe_(...(args as [])),
  forgetQueryPath: (...args: unknown[]) => forget(...(args as []))
}));

beforeEach(() => {
  stores = [];
  describe_.mockReturnValue(undefined);
  forget.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CacheViewer', () => {
  it('says nothing is cached, and why that is the normal answer', () => {
    makeEntry('root');
    render(<CacheViewer />);

    expect(screen.getByText('Nothing on this page is cached')).toBeTruthy();
    expect(screen.getByText(/turns its cache on/)).toBeTruthy();
  });

  it('lists a cached path with its store, its life left and how much of it is gone', () => {
    const queries = makeEntry('Queries');
    queries.store.setState('orders', { rows: [1] }, { ttl: 60_000 });
    render(<CacheViewer />);

    expect(screen.getByText('Queries')).toBeTruthy();
    expect(screen.getByText('orders')).toBeTruthy();
    expect(screen.getByText('1m 0s left')).toBeTruthy();
    expect(screen.getByText('written 0s ago · ttl 1m 0s')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    expect(screen.getByText('15s left')).toBeTruthy();
  });

  it('counts a path down to stale', () => {
    const entry = makeEntry('Queries');
    entry.store.setState('orders', [1], { ttl: 3_000 });
    render(<CacheViewer />);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByText('stale')).toBeTruthy();
  });

  it('leaves out what was written with no life at all', () => {
    const entry = makeEntry('Queries');
    // An uncached provider writes every answer this way: held, never served.
    entry.store.setState('uncached', [1], { ttl: 0 });
    render(<CacheViewer />);

    expect(screen.getByText('Nothing on this page is cached')).toBeTruthy();
  });

  it('shows what a path holds without leaving the tab', () => {
    const entry = makeEntry('Queries');
    entry.store.setState('orders', { title: 'Order 7' }, { ttl: 60_000 });
    render(<CacheViewer />);

    expect(screen.queryByText('Order 7')).toBeNull();

    fireEvent.click(screen.getByText('orders'));

    expect(screen.getByText(/Order 7/)).toBeTruthy();
  });

  it('narrows to what the filter names, and to the stale ones on request', () => {
    const entry = makeEntry('Queries');
    entry.store.setState('orders', [1], { ttl: 60_000 });
    entry.store.setState('users', [1], { ttl: 3_000 });
    render(<CacheViewer />);

    fireEvent.change(screen.getByPlaceholderText('Filter by URL, store or tag'), { target: { value: 'user' } });
    expect(screen.queryByText('orders')).toBeNull();
    expect(screen.getByText('users')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Filter by URL, store or tag'), { target: { value: '' } });
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    fireEvent.click(screen.getByText('Stale only'));

    expect(screen.getByText('users')).toBeTruthy();
    expect(screen.queryByText('orders')).toBeNull();
  });

  it('says when nothing renders a path, and offers to let it go rather than to ask again', () => {
    const entry = makeEntry('Queries');
    entry.store.setState('orders', [1], { ttl: 60_000 });
    // Nothing else can know this, so a plain store's paths keep the "ask again" action.
    describe_.mockReturnValue({ label: 'orders', tags: [], usage: { inUse: false, collectAt: 300_000 } });
    render(<CacheViewer />);

    expect(screen.getByText(/nothing renders it · forgotten in 5m 0s/)).toBeTruthy();

    fireEvent.click(screen.getByText('Forget'));

    expect(forget).toHaveBeenCalledWith(entry.store, 'orders');
  });

  it('expires one path, or every path of every store', () => {
    const first = makeEntry('root');
    const second = makeEntry('Queries');
    first.store.setState('orders', [1], { ttl: 60_000 });
    second.store.setState('users', [1], { ttl: 60_000 });
    render(<CacheViewer />);

    const ordersRow = screen.getByText('orders').closest('li');
    expect(ordersRow).not.toBeNull();
    fireEvent.click(within(ordersRow ?? document.body).getByText('Expire'));

    expect(first.store.isStale('orders')).toBe(true);
    expect(second.store.isStale('users')).toBe(false);

    fireEvent.click(screen.getByText('Expire all'));

    expect(second.store.isStale('users')).toBe(true);
    expect(screen.getAllByText('stale')).toHaveLength(2);
  });
});
