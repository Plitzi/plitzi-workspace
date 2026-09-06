import { use } from 'react';

import AuthContext from './AuthContext';

import type { AuthContextValue } from './AuthContext';

/**
 * Throws outside the provider rather than handing back an empty object.
 *
 * The 2023 context defaulted to `{}`, so a component mounted outside it read `isAuthenticated` as `undefined` and
 * quietly rendered the signed-out branch — a bug that looks exactly like a session that did not restore.
 */
export const useAuth = (): AuthContextValue => {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth was called outside AuthProvider');
  }

  return value;
};

export default useAuth;
