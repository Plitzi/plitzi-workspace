import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@plitzi/sdk-auth';

import { Account } from './Account';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { AccountProps } from './Account';
import type { AuthContextValue } from '@plitzi/sdk-shared';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

const surface = vi.hoisted(() => ({ previewMode: true }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: surface.previewMode } })
}));

vi.mock('@plitzi/sdk-shared/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/store')>()),
  useCommonStore: (path: string) => [path === 'navigation.href' ? 'https://site.test/pricing?plan=pro' : undefined],
  useSdkStore: () => [navigate]
}));

const entry = elementEntry('account', {
  plitziJsxSkipHOC: true,
  definition: { rootId: 'root', label: 'Account', type: 'account', styleSelectors: { base: '' } }
});

const login = vi.fn(() => Promise.resolve({ ok: true as const, accessToken: '' }));
const logout = vi.fn(() => Promise.resolve());

/** The account in a page whose session is `auth`. */
const drawn = (props: AccountProps, auth: Partial<AuthContextValue>) =>
  render(
    // The provider's whole value is never needed here: the account reads these few.
    <AuthContext value={{ login, logout, provider: 'server', ...auth } as AuthContextValue}>
      <ElementContext value={entry}>
        <Account {...props}>
          <a href="/profile">Profile</a>
        </Account>
      </ElementContext>
    </AuthContext>
  ).container;

const signedIn: Partial<AuthContextValue> = {
  state: 'authenticated',
  authenticated: true,
  user: {
    details: { id: 1, username: 'Ada Lovelace', email: 'ada@example.com', verified: true, permissions: [], roles: [] }
  }
};

describe('Account', () => {
  beforeEach(() => {
    surface.previewMode = true;
    navigate.mockClear();
    login.mockClear();
    logout.mockClear();
  });

  it('shows nothing while the session is still being found out', () => {
    const box = drawn({}, { state: 'initLoading' }).querySelector('.plitzi-component__account');

    expect(box?.children).toHaveLength(0);
    expect(box?.getAttribute('aria-busy')).toBe('true');
  });

  it('sends a guest to the sign-in page with the way back, or to the provider’s own', () => {
    const link = drawn({ signInHref: '/sign-in' }, { state: 'guest' }).querySelector('a');

    expect(link?.getAttribute('href')).toBe('/sign-in?redirect=%2Fpricing%3Fplan%3Dpro');

    drawn({}, { state: 'guest' });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(login).toHaveBeenCalledWith({});
  });

  it('opens, for somebody signed in, their name and address, what it holds and signing out', async () => {
    const container = drawn({ signOutHref: '/' }, signedIn);

    expect(container.querySelector('summary')?.textContent).toBe('ALAda Lovelace');
    expect(screen.getByText('ada@example.com')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      await Promise.resolve();
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('is shown open in the builder, as somebody signed in sees it, for its entries to be edited', () => {
    surface.previewMode = false;
    const container = drawn({}, { state: 'guest' });

    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByText('Profile')).toBeTruthy();
  });
});
