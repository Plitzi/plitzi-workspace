import { describe, expect, it } from 'vitest';

import { openPage } from './settle';

import type { SettlingPage, SettlingRequest } from './settle';

type Listener = (request: SettlingRequest) => void;

const request = (url: string, accept = '*/*', resourceType = 'fetch'): SettlingRequest => ({
  url: () => url,
  resourceType: () => resourceType,
  headers: () => ({ accept })
});

/** A page whose requests the test starts and ends — the clock is real, the waits are short. */
const fakePage = (onLoad: (emit: (event: string, request: SettlingRequest) => void) => void) => {
  const listeners = new Map<string, Set<Listener>>();
  const emit = (event: string, asked: SettlingRequest) => listeners.get(event)?.forEach(listener => listener(asked));
  const page: SettlingPage = {
    goto: () => {
      onLoad(emit);

      return Promise.resolve({ ok: true });
    },
    on: (event: string, listener: Listener) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
    },
    off: (event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener);
    },
    waitForTimeout: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
  };

  return { page, listeners };
};

describe('openPage', () => {
  /** A live channel's stream never ends: `networkidle` waited for it forever, and the check said nothing answered. */
  it('settles on a page whose realtime stream stays open', async () => {
    const stream = request('/_realtime?topics=news', 'text/event-stream');
    const { page, listeners } = fakePage(emit => emit('request', stream));
    const startedAt = Date.now();

    await expect(openPage(page, '/', { quietMs: 50, timeout: 2000 })).resolves.toEqual({ ok: true });

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(
      [...listeners.values()].every(set => set.size === 0),
      'it left its listeners on the page'
    ).toBe(true);
  });

  it('waits for the requests that do end', async () => {
    const data = request('/_rsc?location=%2F');
    let ended = 0;
    const { page } = fakePage(emit => {
      emit('request', data);
      setTimeout(() => {
        ended = Date.now();
        emit('requestfinished', data);
      }, 200);
    });

    await openPage(page, '/', { quietMs: 50, timeout: 2000 });

    expect(ended).toBeGreaterThan(0);
    expect(Date.now() - ended).toBeGreaterThanOrEqual(40);
  });

  it('answers null when nothing answers', async () => {
    const page: SettlingPage = {
      ...fakePage(() => undefined).page,
      goto: () => Promise.reject(new Error('net::ERR_CONNECTION_REFUSED'))
    };

    await expect(openPage(page, '/')).resolves.toBeNull();
  });
});
