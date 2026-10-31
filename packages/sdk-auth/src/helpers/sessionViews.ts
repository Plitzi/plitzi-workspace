import { omit } from '@plitzi/plitzi-ui/helpers';

import type { AuthContextValue, SignedInTestAccount } from '@plitzi/sdk-shared';

/**
 * The page's auth as a visitor with no session sees it — as the server plays a journey: signed out, no one's details or
 * token, no permission. What it can do is kept: a journey that signs in, signs in.
 */
export const guestAuth = (auth: AuthContextValue): AuthContextValue => ({
  ...omit(auth, ['user']),
  authenticated: false,
  state: 'guest',
  can: () => false
});

/**
 * The page's auth as a journey's test account (`tests.accounts`) — signed in with its details, roles and what they give,
 * and a token no server takes (`test:<id>`): a page that reads its session by the token sees one, and the API answers
 * it as a guest. Signing out drops it (`signOut`), as a person's would.
 */
export const testAccountAuth = (
  auth: AuthContextValue,
  account: SignedInTestAccount,
  signOut: () => void
): AuthContextValue => {
  const { permissions } = account;

  return {
    ...auth,
    authenticated: true,
    state: 'authenticated',
    can: permission => permissions.includes(permission),
    logout: () => Promise.resolve(signOut()),
    user: {
      details: {
        id: 0,
        username: account.id,
        email: account.email ?? '',
        verified: true,
        permissions,
        roles: account.roles ?? []
      },
      accessToken: `test:${account.id}`
    }
  };
};
