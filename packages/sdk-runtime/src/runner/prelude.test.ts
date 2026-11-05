import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

import { buildPrelude, guestPrelude } from './prelude';

describe('the prelude every isolate starts with', () => {
  it('brings the web APIs a bare V8 lacks, to a context that has none of them', async () => {
    // A context of its own has the language's built-ins and none of Node's or the browser's globals: what an isolate has.
    const context = vm.createContext({});
    vm.runInContext(await buildPrelude(), context);

    const answer: unknown = vm.runInContext(
      `[
        new URL('/feed?page=2', 'https://space.example.com').searchParams.get('page'),
        atob(btoa('hola')),
        structuredClone({ at: [1, 2] }).at[1],
        new DOMException('gone', 'AbortError').name
      ]`,
      context
    );

    expect(answer).toEqual(['2', 'hola', 2, 'AbortError']);
  });

  it('is made once a process, whoever asks', async () => {
    const first = guestPrelude();

    expect(guestPrelude()).toBe(first);
    expect((await first).length).toBeGreaterThan(1000);
  });
});
