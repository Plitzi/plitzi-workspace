import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useChannel from './useChannel';

import type { ChannelDeclarations, RealtimeMessage } from '@plitzi/sdk-shared';
import type { PresenceTracker } from '@plitzi/sdk-shared/realtime';

const { store, trackPresence, client } = vi.hoisted(() => ({
  store: { channels: undefined as ChannelDeclarations | undefined },
  trackPresence: vi.fn<
    (client: unknown, topic: string, handlers: { onMessage: (message: RealtimeMessage) => void }) => PresenceTracker
  >(() => ({
    set: vi.fn(),
    members: () => [],
    stop: vi.fn()
  })),
  client: { status: 'open', me: 'page-1', refusal: () => undefined, onStatus: () => () => undefined }
}));

vi.mock('@plitzi/sdk-shared/store', () => ({
  useCommonStore: (path: string) => {
    if (path === 'schema.settings.channels') {
      return [store.channels];
    }

    return [path === 'realtime.endpoint' ? '/_realtime' : undefined];
  }
}));

vi.mock('@plitzi/sdk-shared/realtime', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/realtime')>()),
  realtimeClientFor: () => client,
  trackPresence
}));

const openedTopics = () => trackPresence.mock.calls.map(([, topic]) => topic);

beforeEach(() => {
  trackPresence.mockClear();
  store.channels = { 'room:{id}': { access: { mode: 'public' } } };
});

describe('useChannel', () => {
  it('waits for a topic written from data that has not arrived, and opens it once it names one', () => {
    const { rerender } = renderHook(({ topic }) => useChannel(topic), {
      initialProps: { topic: 'room:{{ apiContainer_room.id }}' }
    });
    rerender({ topic: 'room:' });
    expect(openedTopics()).toEqual([]);

    rerender({ topic: 'room:test-room' });
    expect(openedTopics()).toEqual(['room:test-room']);
  });

  it('opens nothing no channel of the space covers', () => {
    renderHook(() => useChannel('board:1'));

    expect(openedTopics()).toEqual([]);
  });
});

/** What a `retain: true` channel keeps is state: there as the page joins, the newest of a type holding. */
describe('useChannel / retained', () => {
  const kept = (type: string, data: unknown, at: number): RealtimeMessage => ({
    topic: 'desk',
    type,
    data,
    from: 'server',
    at,
    retained: true
  });

  it('holds the newest of each type, whatever order they arrive in, and forgets one said as null', () => {
    store.channels = { desk: { access: { mode: 'public' }, publish: 'server', retain: true } };
    const { result } = renderHook(() => useChannel('desk'));
    const [, , { onMessage }] = trackPresence.mock.calls[0];

    act(() => {
      onMessage(kept('lists', ['milk', 'eggs'], 20));
      // Heard live, then handed again as the page joined: the older copy arrives last.
      onMessage(kept('lists', ['milk'], 10));
      onMessage(kept('habits', 3, 15));
    });

    expect(result.current.retained).toEqual({ lists: ['milk', 'eggs'], habits: 3 });

    act(() => onMessage(kept('habits', null, 30)));

    expect(result.current.retained).toEqual({ lists: ['milk', 'eggs'] });
  });

  it('keeps nothing a page said, whatever it claims', () => {
    store.channels = { room: { access: { mode: 'public' } } };
    const { result } = renderHook(() => useChannel('room'));
    const [, , { onMessage }] = trackPresence.mock.calls[0];

    act(() => onMessage({ ...kept('lists', ['x'], 1), from: 'page-2' }));

    expect(result.current.retained).toEqual({});
  });
});
