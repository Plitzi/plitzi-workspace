import AuthProvider from '../AuthProvider';

import type { AuthProviderSettings } from '../types';
import type { AuthResult } from '@plitzi/sdk-shared';

const unimplemented = (): never => {
  throw new Error('The auth0 provider is declared but not implemented yet — select `basic`, or register your own.');
};

/**
 * Placeholder for the Auth0 flow. It is a named option in the space settings and in the element sources, so it exists
 * as a provider that refuses clearly rather than as a silent no-op that leaves a space looking signed out.
 */
class Auth0Provider<U = Record<string, unknown>> extends AuthProvider<U> {
  readonly name = 'auth0';

  constructor(settings: AuthProviderSettings = {}) {
    super(settings);
  }

  protected get capabilities() {
    return { renew: false, identity: false };
  }

  protected requestLogin(): Promise<AuthResult<U>> {
    return unimplemented();
  }

  protected requestRenewal(): Promise<AuthResult<U>> {
    return unimplemented();
  }

  protected requestIdentity(): Promise<AuthResult<U>> {
    return unimplemented();
  }

  protected requestLogout(): Promise<void> {
    return unimplemented();
  }
}

export default Auth0Provider;
