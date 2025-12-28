import get from 'lodash-es/get';

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
  expirationTimePath?: string;
};

class BasicAuthProvider<T = Record<string, unknown>> extends AuthProvider<T> {
  readonly name = 'basic';
  authenticated = false;
  protected baseUrl?: string;
  protected options: {
    tokenStorage: Exclude<Schema['settings']['tokenStorage'], undefined>;
    loginUrl: string;
    userUrl: string;
    refreshUrl: string;
    logoutUrl: string;
    detailsPath: string;
    tokenPath: string;
    expirationTimePath: string;
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
    expirationTimePath = ''
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
      expirationTimePath
    };
  }

  async init() {
    this.setState('initLoading');
    await this.getUser();
  }

  isAvailable(): boolean {
    return true;
  }

  can(permission: string): boolean {
    if (!this.cache?.user) {
      return false;
    }

    return get(this.cache.user, 'permissions', [] as string[]).includes(permission);
  }

  private getTokenFromResponse(res: { data?: unknown; status: number }) {
    if (res.status >= 400) {
      return undefined;
    }

    const tokenResult = {
      accessToken: get(res.data, this.options.tokenPath) as string,
      refreshToken: get(res.data, this.options.refreshUrl, null),
      expiresAt: get(res.data, this.options.expirationTimePath, 0)
    };

    return tokenResult;
  }

  async login(authParams: Record<string, string>): Promise<TokenResult | undefined> {
    const { username = '', password = '' } = authParams;
    super.setState('authenticating');
    const res = await this.request(this.options.loginUrl, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const tokenResult = this.getTokenFromResponse(res);
    super.internalLogin(get(res.data, this.options.detailsPath) as T, tokenResult);

    return tokenResult;
  }

  async getUser(): Promise<T | undefined> {
    if (this.cache?.user && this.state !== 'init') {
      return this.cache.user;
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
      body: JSON.stringify({ refreshToken: this.cache?.token?.refreshToken })
    });

    const tokenResult = this.getTokenFromResponse(res);
    super.internalRefresh(tokenResult);

    return tokenResult;
  }

  async logout(): Promise<void> {
    await this.request(this.options.logoutUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    super.internalLogout();
  }
}

export default BasicAuthProvider;
