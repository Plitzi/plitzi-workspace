import { createContext } from 'react';

import type { AuthApi, SignupBody } from './authApi';
import type { DesktopUser } from './session/session';
import type { ApiResult } from '@pmodules/network';

/**
 * What the sign-in screen shows when a credential is refused.
 *
 * Carried rather than turned into a sentence here: every 401 from this server names its `reason`, and the screen
 * that has to say something useful is the one that knows what the person was doing.
 */
export type AuthFailureResult = { ok: false; reason?: string; error?: string };

export type LoginResult = { ok: true } | AuthFailureResult;

export type AuthContextValue = {
  /** False until the stored session has been read and, if need be, renewed — see `AuthProvider`. */
  ready: boolean;
  isAuthenticated: boolean;
  user?: DesktopUser;
  /** Resolves to the token to send, renewing it first if it is about to die. */
  getAccessToken: () => Promise<string | undefined>;
  login: (username: string, password: string) => Promise<LoginResult>;
  signup: (body: SignupBody) => Promise<ApiResult<unknown>>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  auth: AuthApi;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export default AuthContext;
