import { get } from '@plitzi/plitzi-ui/helpers';

import AuthProvider from '../AuthProvider';

import type { AuthProviderProps } from '../AuthProvider';
import type { Schema, TokenResult } from '@plitzi/sdk-shared';

export type BasicAuthProviderProps = AuthProviderProps & {
  tokenStorage?: Schema['settings']['tokenStorage'];
  loginUrl?: string;
  userUrl?: string;
  refreshUrl?: string;
  logoutUrl?: string;
  detailsPath?: string;
  tokenPath?: string;
  refreshTokenPath?: string;
  expirationTimePath?: string;
  isSSR?: boolean;
};

class BasicAuthProvider<T = Record<string, unknown>> extends AuthProvider<T> {
  readonly name = 'basic';

  protected baseUrl?: string;
  protected options: {
    tokenStorage: Exclude<Schema['settings']['tokenStorage'], undefined>;
    loginUrl: string;
    userUrl: string;
    refreshUrl: string;
    logoutUrl: string;
    detailsPath: string;
    tokenPath: string;
    refreshTokenPath: string;
    expirationTimePath: string;
    isSSR: boolean;
  };

  constructor({
    tokenStorage = 'localStorage',
    enableRefresh = true,
    loginUrl = '',
    userUrl = '',
    refreshUrl = '',
    logoutUrl = '',
    detailsPath = '',
    tokenPath = '',
    refreshTokenPath = '',
    expirationTimePath = '',
    isSSR = false
  }: BasicAuthProviderProps = {}) {
    super({ enableRefresh, tokenStorage });
    this.options = {
      tokenStorage,
      loginUrl,
      userUrl,
      refreshUrl,
      logoutUrl,
      detailsPath,
      tokenPath,
      refreshTokenPath,
      expirationTimePath,
      isSSR
    };
  }

  async init(user?: T, skipAuth?: boolean) {
    if (skipAuth) {
      this.setState('guest');

      return;
    }

    this.setState('initLoading');
    if (!this.options.isSSR) {
      await this.getUser();

      return;
    }

    if (user) {
      super.internalGetUser(user);
    } else {
      this.setState('guest');
    }
  }

  // Methods

  async login(authParams: Record<string, string>): Promise<TokenResult | undefined> {
    const { username = '', password = '' } = authParams;
    super.setState('authenticating');
    const res = await this.request<Record<string, unknown>>(this.options.loginUrl, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const result = this.getTokenFromResponse(res);
    super.internalLogin(get(res.data, this.options.detailsPath) as T, result);

    return result;
  }

  async getUser(): Promise<T | undefined> {
    if (this.cache?.user && this.state !== 'init') {
      return this.cache.user;
    }

    if (!this.options.userUrl) {
      super.internalGetUser(undefined);

      return undefined;
    }

    const res = await this.request<T>(this.options.userUrl, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    super.internalGetUser(get(res.data, this.options.detailsPath) as T);

    return res.data;
  }

  async refresh(): Promise<TokenResult | undefined> {
    const res = await this.request<Record<string, unknown>>(this.options.refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.cache?.token?.refreshToken ?? '' })
    });

    const tokenResult = this.getTokenFromResponse(res);
    super.internalRefresh(tokenResult);

    return tokenResult;
  }

  can(permission: string): boolean {
    if (!this.cache?.user) {
      return false;
    }

    return get(this.cache.user as { permissions?: string[] }, 'permissions', [] as string[]).includes(permission);
  }

  async logout(): Promise<void> {
    await this.request(this.options.logoutUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    super.internalLogout();
  }

  // Helpers

  private getTokenFromResponse(res: { data?: Record<string, unknown>; status: number }) {
    if (res.status >= 400) {
      return undefined;
    }

    const result = {
      errors: get(res.data, 'errors', {}),
      accessToken: get(res.data, this.options.tokenPath, ''),
      refreshToken: get(res.data, this.options.refreshTokenPath, ''),
      expiresAt: get(res.data, this.options.expirationTimePath, 0)
    } as {
      errors?: Record<string, unknown>;
      accessToken: string | null;
      refreshToken: string | null;
      expiresAt: number | null;
    };

    if (res.data && !('errors' in res.data)) {
      delete result.errors;
    }

    return result as TokenResult;
  }
}

export default BasicAuthProvider;
