import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';

import useSubscriptionsManager from './useSubscriptionsManager';

import type { ApolloClient } from '@apollo/client/core';
import type { Element } from '@plitzi/sdk-shared';

const element = { id: 'el1', attributes: {}, definition: { label: 'L', type: 'text', styleSelectors: {} } } as Element;

type Stream = {
  variables: Record<string, unknown> | undefined;
  next: (result: unknown) => void;
  closed: boolean;
};

// A stand-in for Apollo that records every stream opened on it, so the tests can assert how many sockets the
// manager really opens — the whole point of the single channel — and push events through them.
const createClient = () => {
  const streams: Stream[] = [];
  const client = {
    subscribe: ({ variables }: { variables?: Record<string, unknown> }) => ({
      subscribe: ({ next }: { next: (result: unknown) => void }) => {
        const stream: Stream = { variables, next, closed: false };
        streams.push(stream);

        return {
          unsubscribe: () => {
            stream.closed = true;
          }
        };
      }
    })
  } as unknown as ApolloClient;

  return { client, streams };
};

const emit = (stream: Stream, event: string, data: unknown) => stream.next({ data: { SpaceEvent: { event, data } } });

const renderManager = (client: ApolloClient, environment = 'dev') =>
  renderHook(({ environment: env }: { environment: string }) => useSubscriptionsManager({ client, environment: env }), {
    initialProps: { environment }
  });

describe('the space stream', () => {
  it('opens one socket however many events are registered', () => {
    const { client, streams } = createClient();
    const { result } = renderManager(client);

    result.current.subscribe('SPACE_ADD_PAGE', vi.fn());
    result.current.subscribe('SPACE_UPDATE_ELEMENT', vi.fn());
    result.current.subscribe('SPACE_REMOVE_ELEMENT', vi.fn());

    expect(streams).toHaveLength(1);
    expect(streams[0].variables).toEqual({ environment: 'dev' });
  });

  it('opens nothing until something is listening', () => {
    const { client, streams } = createClient();

    renderManager(client);

    expect(streams).toHaveLength(0);
  });

  it('opens nothing while disabled', () => {
    const { client, streams } = createClient();
    const { result } = renderHook(() => useSubscriptionsManager({ client, environment: 'dev', disabled: true }));

    expect(result.current.subscribe('SPACE_ADD_PAGE', vi.fn())).toBe(false);
    expect(streams).toHaveLength(0);
  });

  it('closes the socket only when the last listener goes', () => {
    const { client, streams } = createClient();
    const { result } = renderManager(client);

    result.current.subscribe('SPACE_ADD_PAGE', vi.fn());
    result.current.subscribe('SPACE_UPDATE_ELEMENT', vi.fn());

    result.current.unsubscribe('SPACE_ADD_PAGE');
    expect(streams[0].closed).toBe(false);

    result.current.unsubscribe(['SPACE_UPDATE_ELEMENT']);
    expect(streams[0].closed).toBe(true);
  });

  it('closes the socket when the manager unmounts', () => {
    const { client, streams } = createClient();
    const { result, unmount } = renderManager(client);

    result.current.subscribe('SPACE_ADD_PAGE', vi.fn());
    unmount();

    expect(streams[0].closed).toBe(true);
  });

  // The environment rides in the stream's variables, so it cannot be swapped in place.
  it('reopens on another environment, and only then', () => {
    const { client, streams } = createClient();
    const { result, rerender } = renderManager(client);

    result.current.subscribe('SPACE_ADD_PAGE', vi.fn());
    rerender({ environment: 'dev' });
    expect(streams).toHaveLength(1);

    rerender({ environment: 'production' });

    expect(streams).toHaveLength(2);
    expect(streams[0].closed).toBe(true);
    expect(streams[1].variables).toEqual({ environment: 'production' });
  });
});

describe('what reaches a handler', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('hands the payload to the handlers of that event, and to no others', () => {
    const { client, streams } = createClient();
    const { result } = renderManager(client);
    const onUpdate = vi.fn();
    const onRemove = vi.fn();

    result.current.subscribe('SPACE_UPDATE_ELEMENT', onUpdate);
    result.current.subscribe('SPACE_REMOVE_ELEMENT', onRemove);
    emit(streams[0], 'SPACE_UPDATE_ELEMENT', { element });

    expect(onUpdate).toHaveBeenCalledWith({ element });
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('fans one event out to every handler registered for it', () => {
    const { client, streams } = createClient();
    const { result } = renderManager(client);
    const first = vi.fn();
    const second = vi.fn();

    result.current.subscribe('SPACE_REMOVE_PAGE', first);
    result.current.subscribe('SPACE_REMOVE_PAGE', second);
    emit(streams[0], 'SPACE_REMOVE_PAGE', { pageId: 'p1' });

    expect(first).toHaveBeenCalledWith({ pageId: 'p1' });
    expect(second).toHaveBeenCalledWith({ pageId: 'p1' });
  });

  it('ignores an event nobody is listening for', () => {
    const { client, streams } = createClient();
    const { result } = renderManager(client);
    const onUpdate = vi.fn();

    result.current.subscribe('SPACE_UPDATE_ELEMENT', onUpdate);

    expect(() => emit(streams[0], 'SPACE_ADD_PAGE', { page: element })).not.toThrow();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('ignores a message carrying no event', () => {
    const { client, streams } = createClient();
    const { result } = renderManager(client);
    const onUpdate = vi.fn();

    result.current.subscribe('SPACE_UPDATE_ELEMENT', onUpdate);

    expect(() => streams[0].next({ data: undefined })).not.toThrow();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  /**
   * The compiler agreed with the server only for the build each side was compiled in, and the payload is JSON on the
   * wire. A shape that does not match the event is dropped and named — never handed to a reducer to fail three
   * calls deep.
   */
  it('drops a payload that is not what the event carries, and says so', () => {
    const { client, streams } = createClient();
    const { result } = renderManager(client);
    const danger = vi.spyOn(pConsole, 'danger').mockImplementation(() => undefined);
    const onUpdate = vi.fn();

    result.current.subscribe('SPACE_UPDATE_ELEMENT', onUpdate);
    emit(streams[0], 'SPACE_UPDATE_ELEMENT', { elements: [element] });

    expect(onUpdate).not.toHaveBeenCalled();
    expect(danger).toHaveBeenCalledOnce();

    const [category, , params] = danger.mock.calls[0] as [string, unknown, { event: string; issues: unknown[] }];

    expect(category).toBe('network');
    expect(params.event).toBe('SPACE_UPDATE_ELEMENT');
    expect(params.issues.length).toBeGreaterThan(0);
  });

  it('keeps delivering after a bad payload', () => {
    const { client, streams } = createClient();
    const { result } = renderManager(client);
    vi.spyOn(pConsole, 'danger').mockImplementation(() => undefined);
    const onUpdate = vi.fn();

    result.current.subscribe('SPACE_UPDATE_ELEMENT', onUpdate);
    emit(streams[0], 'SPACE_UPDATE_ELEMENT', { elements: [element] });
    emit(streams[0], 'SPACE_UPDATE_ELEMENT', { element });

    expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ element });
  });
});

/**
 * Compile-time half of the contract: these never run, and the file failing `tsc` IS the assertion. They are here
 * because the payload a handler receives is only as safe as the event name it was registered under.
 */
describe('what the compiler refuses', () => {
  it('narrows the payload from the event name', () => {
    const { client } = createClient();
    // The real thing, not a copy of its type: what is asserted here is the API callers actually reach for.
    const { subscribe } = renderManager(client).result.current;

    subscribe('SPACE_ADD_PAGE', ({ page }) => void page.id);
    // @ts-expect-error no such event
    subscribe('SPACE_MADE_UP', () => undefined);
    // @ts-expect-error SPACE_ADD_PAGE carries `page`, not `pageId`
    subscribe('SPACE_ADD_PAGE', ({ pageId }) => void pageId);
    // @ts-expect-error SPACE_REMOVE_PAGE carries a pageId, not an element
    subscribe('SPACE_REMOVE_PAGE', ({ element: removed }) => void removed);
    subscribe('STYLE_REMOVE_SELECTORS', ({ selectors }) => {
      // @ts-expect-error `selectors` is a list of selectors, not one
      const single: string = selectors;
      void single;
    });

    expect(true).toBe(true);
  });
});
