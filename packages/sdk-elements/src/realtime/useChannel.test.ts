import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useChannel from './useChannel';

import type { ChannelDeclarations } from '@plitzi/sdk-shared';
import type { PresenceTracker } from '@plitzi/sdk-shared/realtime';

const { store, trackPresence, client } = vi.hoisted(() => ({
  store: { channels: undefined as ChannelDeclarations | undefined },
  trackPresence: vi.fn<(client: unknown, topic: string) => PresenceTracker>(() => ({
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
