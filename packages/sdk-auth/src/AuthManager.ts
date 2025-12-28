import Auth0Provider from './providers/Auth0Provider';
import BasicAuthProvider from './providers/BasicAuthProvider';

import type AuthProvider from './AuthProvider';
import type { AuthEventListener, AuthProviderWithCache } from './AuthProvider';
import type { TokenResult } from '@plitzi/sdk-shared';

const providers = {
  // '': BasicAuthProvider,
  // custom: BasicAuthProvider,
  auth0: Auth0Provider,
  basic: BasicAuthProvider
  // ssr: SsrProvider
};

export type Providers = keyof typeof providers;

export class AuthManager<U = Record<string, unknown>, T extends Providers = 'basic'> {
  private providerType: Providers = 'basic';
  private provider?: AuthProvider<U> = undefined;

  constructor(
    providerType: Providers = 'basic',
    listeners: AuthEventListener | AuthEventListener[],
    ...args: ConstructorParameters<(typeof providers)[T]>
  ) {
    this.providerType = providerType;
    if (providers[providerType] as typeof AuthProvider | undefined) {
      this.provider = new providers[providerType](...args);
      this.provider.on(listeners);
    }
  }

  // Methods Getters

  getProviderType(): Providers {
    return this.providerType;
  }

  getProvider(): AuthProviderWithCache<U> | undefined {
    return this.provider;
  }

  // Methods Actions

  init() {
    return this.provider?.init();
  }

  login(...args: Parameters<AuthProvider['login']>) {
    return this.provider?.login(...args) ?? Promise.resolve(undefined);
  }

  refresh(): Promise<TokenResult | undefined> {
    return this.provider?.refresh() ?? Promise.resolve(undefined);
  }

  getUser() {
    return this.provider?.getUser();
  }

  can(permission: string): boolean {
    return this.provider?.can(permission) ?? false;
  }

  logout(): Promise<void> {
    return this.provider?.logout() ?? Promise.resolve();
  }

  on(listener: AuthEventListener): (() => void) | undefined {
    return this.provider?.on(listener);
  }

  // Other methods can be added here as needed
}
