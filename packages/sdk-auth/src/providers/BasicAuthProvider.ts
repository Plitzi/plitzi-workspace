import { get } from '@plitzi/plitzi-ui/helpers';

import { authFailureFromResponse } from '@plitzi/sdk-shared/auth';

import AuthProvider from '../AuthProvider';

import type { AuthProviderProps } from '../AuthProvider';
import type { AuthFailureReason, AuthResult, Schema, TokenResult } from '@plitzi/sdk-shared';

export type BasicAuthProviderProps = AuthProviderProps & {
  loginUrl?: string;
  userUrl?: string;
  refreshUrl?: string;
  logoutUrl?: string;
  detailsPath?: Schema['settings']['detailsPath'];
  tokenPath?: Schema['settings']['tokenPath'];
  refreshTokenPath?: Schema['settings']['refreshTokenPath'];
  expirationTimePath?: Schema['settings']['expirationTimePath'];
  refreshExpirationTimePath?: Schema['settings']['refreshExpirationTimePath'];
};

type Options = Required<Omit<BasicAuthProviderProps, keyof AuthProviderProps>>;

type Response<T> = { data?: T; status: number; reason?: AuthFailureReason };

// The paths are authored by whoever configured the space, so what comes back at one is genuinely unknown: reading it
// as the wrong type is a misconfiguration to absorb, not a crash to hand the visitor.
const valueAt = (data: Record<string, unknown> | undefined, path: string): unknown => get(data, path, undefined);

const stringAt = (data: Record<string, unknown> | undefined, path: string): string | null => {
  const value = valueAt(data, path);

  return typeof value === 'string' && value !== '' ? value : null;
};

const secondsAt = (data: Record<string, unknown> | undefined, path: string): number | null => {
  const value = valueAt(data, path);
  const seconds = typeof value === 'string' ? Number(value) : value;

  return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : null;
};

/**
 * A session over HTTP+JSON: the shape almost every auth backend already speaks, described rather than assumed. Which
 * endpoints exist and where the interesting values sit in their responses come from the space's settings, so a
 * customer points this at their own API without writing any code.
 *
 * Two properties of that backend decide how little this costs at runtime, and both are worth having:
 *
 * - **A grant that answers with the user.** When login and refresh return identity along with the tokens, a returning
 *   visitor is restored in one request instead of two, and often none — and the identity endpoint becomes a fallback
 *   rather than the way sessions are checked.
 * - **A published session hint** (see `sessionHintCookie`). It is what lets "nobody is signed in" be answered without
 *   asking, which is the common case on a public page.
 */
class BasicAuthProvider<U = Record<string, unknown>> extends AuthProvider<U> {
  readonly name = 'basic';

  private readonly options: Options;

  constructor({
    loginUrl = '',
    userUrl = '',
    refreshUrl = '',
    logoutUrl = '',
    detailsPath = 'details',
    tokenPath = 'access_token',
    refreshTokenPath = 'refresh_token',
    expirationTimePath = 'expire_at',
    refreshExpirationTimePath = 'refresh_expire_at',
    ...providerProps
  }: BasicAuthProviderProps = {}) {
    super(providerProps);
    this.options = {
      loginUrl,
      userUrl,
      refreshUrl,
      logoutUrl,
      detailsPath,
      tokenPath,
      refreshTokenPath,
      expirationTimePath,
      refreshExpirationTimePath
    };
  }

  protected get capabilities() {
    return { renew: !!this.options.refreshUrl, identity: !!this.options.userUrl };
  }

  protected get endpoints(): string[] {
    const { loginUrl, userUrl, refreshUrl, logoutUrl } = this.options;

    return [loginUrl, userUrl, refreshUrl, logoutUrl];
  }

  protected async requestLogin(params: Record<string, unknown>): Promise<AuthResult<U>> {
    const res = await this.request<Record<string, unknown>>(this.options.loginUrl, {
      method: 'POST',
      body: JSON.stringify({
        username: typeof params.username === 'string' ? params.username : '',
        password: typeof params.password === 'string' ? params.password : ''
      })
    });

    return this.toResult(res);
  }

  /**
   * The refresh token travels in the body under the name the backend reads it by, and by cookie when the backend
   * keeps it in one — a browser session normally does, which is why this works with nothing in storage at all.
   */
  protected async requestRenewal(refreshToken?: string): Promise<AuthResult<U>> {
    const res = await this.request<Record<string, unknown>>(this.options.refreshUrl, {
      method: 'POST',
      body: JSON.stringify(refreshToken ? { [this.options.refreshTokenPath]: refreshToken } : {})
    });

    return this.toResult(res);
  }

  protected async requestIdentity(): Promise<AuthResult<U>> {
    const res = await this.request<Record<string, unknown>>(this.options.userUrl, { method: 'GET' });

    return this.toResult(res);
  }

  protected async requestLogout(): Promise<void> {
    if (!this.options.logoutUrl) {
      return;
    }

    await this.request(this.options.logoutUrl, { method: 'POST' });
  }

  // Helpers

  private async request<T>(input: string, init: RequestInit): Promise<Response<T>> {
    let res: globalThis.Response;

    try {
      res = await fetch(input, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...init
      });
    } catch {
      // The backend was not reached, so it said nothing — which is not the same as saying no.
      return { status: 0, reason: 'network' };
    }

    let data: T | undefined;

    try {
      data = (await res.json()) as T;
    } catch {
      data = undefined;
    }

    // A refusal that is not about the session (a 4xx from a bad request, a 5xx from a backend having a bad day) leaves
    // the session exactly as it was — `ok` is false but there is nothing to conclude, so it reads as unreachable.
    return {
      data,
      status: res.status,
      reason: res.ok ? undefined : (authFailureFromResponse(res.status, data) ?? 'network')
    };
  }

  private toResult(res: Response<Record<string, unknown>>): AuthResult<U> {
    if (res.reason) {
      return { ok: false, reason: res.reason };
    }

    const details = valueAt(res.data, this.options.detailsPath);
    const user = details !== null && typeof details === 'object' ? (details as U) : undefined;

    return { ok: true, user, token: this.tokenFrom(res.data) };
  }

  private tokenFrom(data?: Record<string, unknown>): TokenResult | undefined {
    const accessToken = stringAt(data, this.options.tokenPath);
    if (!accessToken) {
      return undefined;
    }

    const errors = valueAt(data, 'errors');

    return {
      ...(errors !== null && typeof errors === 'object' ? { errors: errors as Record<string, unknown> } : {}),
      accessToken,
      // Absent is fine: the base reads the lifetime off the token itself when a backend does not state one.
      expiresAt: secondsAt(data, this.options.expirationTimePath),
      refreshToken: stringAt(data, this.options.refreshTokenPath),
      refreshExpiresAt: secondsAt(data, this.options.refreshExpirationTimePath)
    };
  }
}

export default BasicAuthProvider;
