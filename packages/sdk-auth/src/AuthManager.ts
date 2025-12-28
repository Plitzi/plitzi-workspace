import BasicAuthProvider from './providers/BasicAuthProvider';

import type AuthProvider from './AuthProvider';
import type { AuthEventListener, AuthProviderWithCache } from './AuthProvider';
import type { TokenResult } from '@plitzi/sdk-shared';

const providers = {
  // '': BasicAuthProvider,
  // custom: BasicAuthProvider,
  // auth0: BasicAuthProvider,
  basic: BasicAuthProvider
};

export type Providers = keyof typeof providers;

export class AuthManager<U = Record<string, unknown>, T extends Providers = 'basic'> {
  private providerType: Providers = 'basic';
  private provider: AuthProvider<U>;

  constructor(
    providerType: Providers = 'basic',
    listeners: AuthEventListener | AuthEventListener[],
    ...args: ConstructorParameters<(typeof providers)[T]>
  ) {
    this.providerType = providerType;
    this.provider = new providers[providerType](...args);
    this.provider.on(listeners);
  }

  // Methods Getters

  getProviderType(): Providers {
    return this.providerType;
  }

  getProvider(): AuthProviderWithCache<U> {
    return this.provider;
  }

  // Methods Actions

  init() {
    return this.provider.init();
  }

  login(...args: Parameters<AuthProvider['login']>) {
    return this.provider.login(...args);
  }

  refresh(): Promise<TokenResult | undefined> {
    return this.provider.refresh();
  }

  getUser() {
    return this.provider.getUser();
  }

  can(permission: string): boolean {
    return this.provider.can(permission);
  }

  logout(): Promise<void> {
    return this.provider.logout();
  }

  on(listener: AuthEventListener): () => void {
    return this.provider.on(listener);
  }

  // Other methods can be added here as needed
}
