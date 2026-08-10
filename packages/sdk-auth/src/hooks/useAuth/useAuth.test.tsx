import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useAuth from './useAuth';

import type { AuthProviderSettings } from '../../types';
import type { Server } from '@plitzi/sdk-shared';

/**
 * `loading` is what holds a space's pages back, so the server and the browser have to agree about it on the very
 * first render — the server emits HTML from one answer and the browser hydrates against the other.
 *
 * The regression these pin: a guest has no `bootstrapUser`, and `loading` keyed off that alone. The server (where
 * `isHydrating` is false) therefore rendered nothing while the browser (where it is true) rendered the whole tree,
 * and React reported a hydration mismatch on every signed-out page of every server-rendered space.
 */

const settings = {} as AuthProviderSettings;

const guestRender = { authenticated: false } as unknown as Server;
const signedInRender = { authenticated: true, user: { details: { id: 1, username: 'ada' } } } as unknown as Server;

const loadingOn = (server: Server | undefined, isHydrating: boolean): boolean =>
  renderHook(() => useAuth({ server, isHydrating, provider: 'basic', settings })).result.current.loading;

describe('what the server renders and what the browser hydrates', () => {
  it('agree for a signed-out visitor', () => {
    expect(loadingOn(guestRender, false)).toBe(false); // server
    expect(loadingOn(guestRender, true)).toBe(false); // browser
  });

  it('agree for a signed-in visitor', () => {
    expect(loadingOn(signedInRender, false)).toBe(false);
    expect(loadingOn(signedInRender, true)).toBe(false);
  });
});

// Without a server render nobody has answered yet, so the page does wait — that is the case `loading` exists for.
describe('a page rendered in the browser alone', () => {
  it('waits until auth has decided', () => {
    expect(loadingOn(undefined, false)).toBe(true);
  });
});
