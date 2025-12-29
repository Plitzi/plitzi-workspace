/* eslint-disable @typescript-eslint/no-dynamic-delete */

import type { Schema, TokenResult } from '@plitzi/sdk-shared';

export type AuthProviderCache<U = Record<string, unknown>> = { token?: TokenResult; user?: U };

export type AuthState = 'init' | 'initLoading' | 'authenticating' | 'authenticated' | 'guest';

export type AuthEvent =
  | { type: 'state'; state: AuthState }
  | { type: 'login'; token: TokenResult }
  | { type: 'logout' }
  | { type: 'expired' };

export type AuthEventListener = (event: AuthEvent) => void;

export type AuthProviderWithCache<U> = AuthProvider<U> & Readonly<AuthProviderCache<U>>;

export type AuthProviderProps = {
  enableRefresh?: boolean;
  tokenStorage?: Schema['settings']['tokenStorage'];
};

abstract class AuthProvider<U = Record<string, unknown>> {
  abstract readonly name: string;

  protected cache?: AuthProviderCache<U>;
  protected enableRefresh: boolean = false;
  protected tokenStorage: Schema['settings']['tokenStorage'] = 'localStorage';
  protected state: AuthState = 'init';
  private listeners = new Set<AuthEventListener>();

  constructor({ enableRefresh = false, tokenStorage = 'localStorage' }: AuthProviderProps = {}) {
    this.enableRefresh = enableRefresh;
    this.tokenStorage = tokenStorage;

    try {
      let cacheStr = null;
      if (tokenStorage === 'localStorage') {
        cacheStr = localStorage.getItem('user_state');
      } else if (tokenStorage === 'sessionStorage') {
        cacheStr = sessionStorage.getItem('user_state');
      }

      if (cacheStr) {
        this.setCache('token', JSON.parse(cacheStr) as AuthProviderCache<U>['token']);
      }
    } catch {
      // nothing here
    }

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        if (target.cache && prop in target.cache && prop === 'token' && tokenStorage === '') {
          // This should only return token data when tokenStorage is used
          return undefined;
        }

        if (target.cache && prop in target.cache) {
          return target.cache[prop as keyof AuthProviderCache<U>];
        }
      }
    });
  }

  abstract init(user?: U, skipAuth?: boolean): Promise<void>;
  abstract login(...args: unknown[]): Promise<TokenResult | undefined>;
  abstract getUser(): Promise<U | undefined>;
  abstract refresh(): Promise<TokenResult | undefined>;
  abstract can(permission: string): boolean;
  abstract logout(): Promise<void>;

  // Methods

  protected internalRefresh(token?: TokenResult) {
    if (!token) {
      this.setState('guest');
      this.setCache(undefined, undefined);
    }

    this.setCache('token', token);
  }

  // Protected Methods

  protected internalGetUser(user?: U) {
    this.setCache('user', user);
    if (!user) {
      this.setState('guest');
      if (this.isExpired()) {
        this.clearCache();
      }
    } else {
      this.setState('authenticated');
    }
  }

  protected internalLogin(user?: U, token?: TokenResult) {
    this.setCache('user', user);
    this.setCache('token', token);
    if (!user) {
      this.setState('guest');
    } else {
      this.setState('authenticated');
    }
  }

  protected internalLogout() {
    this.clearCache();
    this.setState('guest');
    this.emit({ type: 'logout' });
  }

  protected isExpired(): boolean {
    return !this.cache || !this.cache.token || !this.cache.token.expiresAt || Date.now() >= this.cache.token.expiresAt;
  }

  // Cache methods

  protected setCache<T extends keyof AuthProviderCache>(cacheKey: T | undefined, cache: AuthProviderCache<U>[T]): void {
    if (!cacheKey) {
      this.cache = cache as AuthProviderCache<U>;
      if (typeof localStorage !== 'undefined' && this.tokenStorage === 'localStorage' && this.cache.token) {
        localStorage.setItem('user_state', JSON.stringify(this.cache.token));
      } else if (typeof sessionStorage !== 'undefined' && this.tokenStorage === 'sessionStorage' && this.cache.token) {
        sessionStorage.setItem('user_state', JSON.stringify(this.cache.token));
      }

      return;
    }

    if (!this.cache) {
      this.cache = {} as AuthProviderCache<U>;
    }

    this.cache[cacheKey] = cache;

    if (!this.cache.token) {
      return;
    }

    if (typeof localStorage !== 'undefined' && this.tokenStorage === 'localStorage') {
      localStorage.setItem('user_state', JSON.stringify(this.cache.token));
    } else if (typeof sessionStorage !== 'undefined' && this.tokenStorage === 'sessionStorage') {
      sessionStorage.setItem('user_state', JSON.stringify(this.cache.token));
    }
  }

  protected clearCache(cacheKey?: keyof AuthProviderCache<U>): void {
    if (cacheKey && this.cache) {
      delete this.cache[cacheKey];
      if (cacheKey === 'token') {
        if (typeof localStorage !== 'undefined' && this.tokenStorage === 'localStorage') {
          localStorage.removeItem('user_state');
        } else if (typeof sessionStorage !== 'undefined' && this.tokenStorage === 'sessionStorage') {
          sessionStorage.removeItem('user_state');
        }
      }

      return;
    }

    if (typeof localStorage !== 'undefined' && this.tokenStorage === 'localStorage') {
      localStorage.removeItem('user_state');
    } else if (typeof sessionStorage !== 'undefined' && this.tokenStorage === 'sessionStorage') {
      sessionStorage.removeItem('user_state');
    }

    this.cache = undefined;
  }

  // Helper methods

  on(listeners: AuthEventListener | AuthEventListener[]): () => void {
    if (Array.isArray(listeners)) {
      listeners.forEach(listener => this.listeners.add(listener));

      return () => listeners.forEach(listener => this.listeners.delete(listener));
    }

    this.listeners.add(listeners);

    return () => this.listeners.delete(listeners);
  }

  protected emit(event: AuthEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  protected setState(state: AuthState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit({ type: 'state', state });
    }
  }

  getState(): AuthState {
    return this.state;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  protected async request<T>(input: RequestInfo, init?: RequestInit): Promise<{ data?: T; status: number }> {
    let res: Response | undefined;
    try {
      res = await fetch(input, init);
    } catch {
      return Promise.resolve({ data: undefined, status: 500 });
    }

    if (!res.ok) {
      return Promise.resolve({ data: undefined, status: res.status });
    }

    return { data: (await res.json()) as T, status: res.status };
  }
}

export default AuthProvider;
