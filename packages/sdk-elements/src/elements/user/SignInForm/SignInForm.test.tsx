import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@plitzi/sdk-auth';

import { SignInForm } from './SignInForm';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { AuthContextValue, LoginResult } from '@plitzi/sdk-shared';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

const page = vi.hoisted(() => ({ redirect: undefined as string | undefined }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

vi.mock('@plitzi/sdk-shared/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/store')>()),
  useCommonStore: (path: string) => [path === 'navigation.queryParams.redirect' ? page.redirect : undefined],
  useSdkStore: () => [navigate]
}));

const entry = elementEntry('sign-in', {
  plitziJsxSkipHOC: true,
  definition: { rootId: 'root', label: 'Sign-in Form', type: 'signInForm', styleSelectors: { base: '' } }
});

const login = vi.fn<(params: Record<string, unknown>) => Promise<LoginResult>>();

const SIGNED_IN: LoginResult = { ok: true, accessToken: 't', expiresAt: null, refreshToken: null };

const drawn = (provider = 'basic', redirectTo = '') =>
  render(
    // The provider's whole value is never needed here: the form reads these two.
    <AuthContext value={{ login, provider } as unknown as AuthContextValue}>
      <ElementContext value={entry}>
        <SignInForm redirectTo={redirectTo} />
      </ElementContext>
    </AuthContext>
  );

const submit = async (fields: Record<string, string>) => {
  for (const [label, value] of Object.entries(fields)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await Promise.resolve();
  });
};

describe('SignInForm', () => {
  beforeEach(() => {
    login.mockReset();
    navigate.mockClear();
    page.redirect = undefined;
  });

  it('signs in with the address and the password, and goes back to the ?redirect= of this site', async () => {
    login.mockResolvedValue(SIGNED_IN);
    page.redirect = '/billing';
    drawn();

    await submit({ Email: 'ada@example.com', Password: 'secret' });

    expect(login).toHaveBeenCalledWith({ username: 'ada@example.com', password: 'secret' });
    expect(navigate).toHaveBeenCalledWith('/billing');
  });

  it('never follows a ?redirect= to another site', async () => {
    login.mockResolvedValue(SIGNED_IN);
    page.redirect = '//evil.test/steal';
    drawn();

    await submit({ Email: 'ada@example.com', Password: 'secret' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('asks the second factor’s code when the account has one, and completes the sign-in with it', async () => {
    login.mockResolvedValueOnce({ ok: false, reason: 'mfa', mfaToken: 'challenge' });
    login.mockResolvedValueOnce(SIGNED_IN);
    drawn('basic', '/dashboard');

    await submit({ Email: 'ada@example.com', Password: 'secret' });
    await submit({ Code: '123456' });

    expect(login).toHaveBeenLastCalledWith({ mode: 'mfa', mfaToken: 'challenge', code: '123456' });
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('says each refusal for what it is', async () => {
    drawn();

    login.mockResolvedValue({ ok: false, reason: 'unverified' });
    await submit({ Email: 'ada@example.com', Password: 'secret' });
    expect(screen.getByRole('alert').textContent).toBe('Confirm your email first: the link is in your inbox.');

    login.mockResolvedValue({ ok: false, reason: 'missing' });
    await submit({});
    expect(screen.getByRole('alert').textContent).toBe('That email or password is not right.');
  });

  it('is one button through a provider that signs in out and back, and says so when there is none', () => {
    drawn('server');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(login).toHaveBeenCalledWith({});
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('says signing in is not set up when the page has no provider', () => {
    drawn('');

    expect(screen.getByRole('alert').textContent).toBe('Signing in is not set up for this site.');
  });
});
