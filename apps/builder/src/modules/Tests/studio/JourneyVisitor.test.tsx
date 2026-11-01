// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { use } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@plitzi/sdk-auth';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import JourneyVisitor from './JourneyVisitor';

import type { AuthContextValue } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));

/** A journey on the canvas or none — and the test account laid over the page, when there is one. */
const onCanvas = (on: boolean, account?: { id: string }) =>
  vi.mocked(useBuilderStore).mockImplementation((() => [[on, account]]) as unknown as typeof useBuilderStore);

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
    <JourneyVisitor>
      <Seen />
    </JourneyVisitor>
  </AuthContext>
);

// A journey that met a guarded page passed on the server, which plays as a guest, and failed on the canvas.
describe('the canvas while a journey is on it', () => {
  it('shows the page the editor’s session, until a journey is on it — then none, as the server plays it', () => {
    onCanvas(false);
    const { rerender } = render(page(signedIn('editor')));
    expect(screen.getByText('true authenticated editor true')).toBeTruthy();

    onCanvas(true);
    rerender(page(signedIn('editor')));
    expect(screen.getByText('false guest none false')).toBeTruthy();

    onCanvas(false);
    rerender(page(signedIn('editor')));
    expect(screen.getByText('true authenticated editor true')).toBeTruthy();
  });

  it('shows a session the journey signs in to as its own', () => {
    onCanvas(true);
    const { rerender } = render(page(signedIn('editor')));
    expect(screen.getByText('false guest none false')).toBeTruthy();

    rerender(page(signedIn('journey')));
    expect(screen.getByText('true authenticated journey true')).toBeTruthy();
  });

  // A journey opened as its account showed the page as the editor until it was played.
  it('shows the page its test account when one is laid over it — the editor’s session never', () => {
    onCanvas(false);
    const { rerender } = render(page(signedIn('editor')));
    onCanvas(true, { id: 'member' });
    rerender(page(signedIn('test:member')));
    expect(screen.getByText('true authenticated test:member true')).toBeTruthy();

    onCanvas(true);
    rerender(page(signedIn('editor')));
    expect(screen.getByText('false guest none false')).toBeTruthy();
  });
});
