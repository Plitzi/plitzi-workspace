// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { use } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@plitzi/sdk-auth';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import GuestWhilePlaying from './GuestWhilePlaying';

import type { AuthContextValue } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));

const playing = (on: boolean) =>
  vi.mocked(useBuilderStore).mockImplementation((() => [on]) as unknown as typeof useBuilderStore);

/** A session as the editor holds one, by its token. */
const signedIn = (token: string): AuthContextValue =>
  ({
    authenticated: true,
    state: 'authenticated',
    provider: 'plitzi',
    can: () => true,
    user: {
      accessToken: token,
      details: { id: 1, username: 'admin', email: 'a@b.c', verified: true, permissions: [], roles: [] }
    }
  }) as unknown as AuthContextValue; // What the page reads of it: its methods are not called here.

const Seen = () => {
  const auth = use(AuthContext);

  return (
    <span>{`${String(auth.authenticated)} ${auth.state} ${auth.user?.accessToken ?? 'none'} ${String(auth.can('x'))}`}</span>
  );
};

const page = (auth: AuthContextValue) => (
  <AuthContext value={auth}>
    <GuestWhilePlaying>
      <Seen />
    </GuestWhilePlaying>
  </AuthContext>
);

// A journey that met a guarded page passed on the server, which plays as a guest, and failed on the canvas.
describe('the canvas while a journey plays', () => {
  it('shows the page the editor’s session, until a play — then none, as the server plays it', () => {
    playing(false);
    const { rerender } = render(page(signedIn('editor')));
    expect(screen.getByText('true authenticated editor true')).toBeTruthy();

    playing(true);
    rerender(page(signedIn('editor')));
    expect(screen.getByText('false guest none false')).toBeTruthy();

    playing(false);
    rerender(page(signedIn('editor')));
    expect(screen.getByText('true authenticated editor true')).toBeTruthy();
  });

  it('shows a session the journey signs in to as its own', () => {
    playing(true);
    const { rerender } = render(page(signedIn('editor')));
    expect(screen.getByText('false guest none false')).toBeTruthy();

    rerender(page(signedIn('journey')));
    expect(screen.getByText('true authenticated journey true')).toBeTruthy();
  });
});
