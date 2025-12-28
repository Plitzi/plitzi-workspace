import AuthProvider from '../AuthProvider';

import type { AuthProviderProps } from '../AuthProvider';
import type { Schema, TokenResult } from '@plitzi/sdk-shared';

export type Auth0ProviderProps = AuthProviderProps & {
  tokenStorage?: Schema['settings']['tokenStorage'];
  loginUrl?: string;
  userUrl?: string;
  refreshUrl?: string;
  logoutUrl?: string;
  detailsPath?: string;
  tokenPath?: string;
  expirationTimePath?: string;
};

class Auth0Provider<T = Record<string, unknown>> extends AuthProvider<T> {
  readonly name = 'auth0';

  init(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  // Methods

  login(...args: unknown[]): Promise<TokenResult | undefined> {
    console.log(args);
    throw new Error('Method not implemented.');
  }

  getUser(): Promise<T | undefined> {
    throw new Error('Method not implemented.');
  }

  refresh(): Promise<TokenResult | undefined> {
    throw new Error('Method not implemented.');
  }

  can(permission: string): boolean {
    console.log(permission);
    throw new Error('Method not implemented.');
  }

  logout(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export default Auth0Provider;
