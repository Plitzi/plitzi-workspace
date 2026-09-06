import { createContext } from 'react';

import type { AuthApi } from './authApi';
import type { DesktopUser } from './session/session';

/**
 * What the sign-in screen shows when a flow does not complete.
 *
 * Carried rather than turned into a sentence here: the screen that has to say something useful is the one that
 * knows what the person was doing.
 */
export type AuthFailureResult = { ok: false; reason?: string; error?: string };

export type SignInResult = { ok: true } | AuthFailureResult;

export type AuthContextValue = {
  /** False until the stored session has been read and, if need be, renewed — see `AuthProvider`. */
  ready: boolean;
  isAuthenticated: boolean;
  user?: DesktopUser;
  /** Resolves to the token to send, renewing it first if it is about to die. */
  getAccessToken: () => Promise<string | undefined>;
  /**
   * Sign in, which happens in the person's browser and not in this window.
   *
   * It takes no credentials, and cannot: the window opens the platform's sign-in screen and waits for a session
   * on a loopback address. That is what replaced a `login(username, password)` here, and with it four forms.
   */
  signIn: () => Promise<SignInResult>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  auth: AuthApi;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export default AuthContext;
