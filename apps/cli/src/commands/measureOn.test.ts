import { describe, expect, it } from 'vitest';

import { measureOn } from './measureOn';

import type { BrowserPage } from '../browser';

/** A page with nothing on it: every selector finds none. */
const empty = {
  url: () => 'http://127.0.0.1:8301/r/night-drive',
  locator: () => ({ first: () => ({ count: () => Promise.resolve(0) }) })
};

// encore-10: page measure on roomSkipRead, an apiContainer, guessed it was for signed-in visitors or behind a click.
describe('a provider measured', () => {
  it('is said to draw no box of its own, never guessed absent', async () => {
    // The fake answers what finding an element calls of a page, and nothing else a page has.
    const page = empty as unknown as BrowserPage;

    expect(await measureOn(page, 'roomSkipRead', { boxless: id => Promise.resolve(id === 'roomSkipRead') })).toEqual({
      problem: 'roomSkipRead draws no box of its own — a provider, drawn as what it holds: measure one of its children'
    });
  });
});
