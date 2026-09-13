import { createContext } from 'react';

import type { AuthApi } from './authApi';
import type { DesktopUser } from './session/session';
import type { ApiRequest, ApiResult } from '@pmodules/network';

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
  /**
   * True when the session ended because the server refused it, and false after an explicit sign-out.
   *
   * The distinction is the whole of it: one is something that happened TO somebody and needs a sentence, the other
   * is something they asked for and needs none.
   */
  expired: boolean;
  user?: DesktopUser;
  /**
   * The way this window calls the API — with the session on it, and with a 401 believed.
   *
   * A token is deliberately NOT handed out. Every caller that held one answered a 401 the same wrong way: show an
   * error and keep the session, which leaves the window signed in to a server that disagrees and retrying forever.
   * Here that decision is made once: renew, retry, and if it is refused again, end the session so the window
   * returns to the sign-in screen.
   */
  request: <T>(request: Omit<ApiRequest, 'token'>) => Promise<ApiResult<T>>;
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
