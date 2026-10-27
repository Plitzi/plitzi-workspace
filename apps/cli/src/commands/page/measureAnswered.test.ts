import { describe, expect, it } from 'vitest';

import { answered } from './measureState';

import type { BrowserPage } from '../../browser';
import type { SettlingRequest } from '@plitzi/sdk-authoring';

type Listener = (request: SettlingRequest) => void;

/** A page as far as `answered` meets it: its requests' events, and a wait. */
const pageOf = () => {
  const listeners = new Map<string, Set<Listener>>();
  const emit = (event: string, request: SettlingRequest): void => {
    for (const listener of listeners.get(event) ?? []) {
      listener(request);
    }
  };
  const page = {
    on: (event: string, listener: Listener) =>
      listeners.set(event, new Set([...(listeners.get(event) ?? []), listener])),
    off: (event: string, listener: Listener) => listeners.get(event)?.delete(listener),
    waitForTimeout: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
  };

  // The fake answers what `answered` calls of a page, and nothing else a page has.
  return { page: page as unknown as BrowserPage, emit };
};

const request = (resourceType: string, accept = '*/*'): SettlingRequest => ({
  url: () => 'http://127.0.0.1/_action',
  resourceType: () => resourceType,
  headers: () => ({ accept })
});

// The down key, lit by the vote's answer, measured unlit — the page was read before the action landed.
describe('a step whose server answer the page is read after', () => {
  it('waits for the fetch the step started, never for a stream', async () => {
    const { page, emit } = pageOf();
    const vote = request('fetch');
    const events = request('fetch', 'text/event-stream');
    let landed = false;

    await answered(page, () => {
      emit('request', vote);
      emit('request', events);
      setTimeout(() => {
        landed = true;
        emit('requestfinished', vote);
      }, 120);

      return Promise.resolve();
    });

    expect(landed).toBe(true);
  });
});
