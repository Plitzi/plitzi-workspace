import AuthProvider from '../AuthProvider';

import type { AuthProviderProps } from '../AuthProvider';
import type { AuthResult, MfaChallenge } from '@plitzi/sdk-shared';

export type ServerAuthProviderProps = AuthProviderProps & {
  /** Where the page server starts a sign-in by redirect. Default `/auth/sign-in` (`createServer({ signIn })`). */
  loginUrl?: string;
  /** Where the page server ends the session on its host. Default `/auth/logout`. */
  logoutUrl?: string;
};

/**
 * A space whose people sign in THROUGH the server that renders it: signing in is a redirect out and back
 * (`createServer({ signIn })` — "Sign in with Plitzi" on the platform), and the session is a cookie on the space's
 * own host that the page never holds.
 *
 * So there is nothing here to store, renew or ask about. Who is signed in is what the server rendered the page for —
 * it resolves the visitor on every request and hands the answer over with the page — and it is the server that ends a
 * session. What this provider does is the two things only a browser can: go and sign in, and ask to sign out.
 */
class ServerAuthProvider<U = Record<string, unknown>> extends AuthProvider<U> {
  readonly name = 'server';

  private readonly loginUrl: string;

  private readonly logoutUrl: string;

  constructor({ loginUrl = '', logoutUrl = '', ...providerProps }: ServerAuthProviderProps = {}) {
    // Nothing to keep: the credential is an httpOnly cookie on this host, invisible to the page by design.
    super({ ...providerProps, tokenStorage: '' });
    this.loginUrl = loginUrl || '/auth/sign-in';
    this.logoutUrl = logoutUrl || '/auth/logout';
  }

  protected get capabilities(): { renew: boolean; identity: boolean } {
    return { renew: false, identity: false };
  }

  /**
   * Off to sign in, and back to this very page. The promise never settles: the page is being left, and whatever it
   * said next would be said to nobody.
   */
  protected requestLogin(): Promise<AuthResult<U> | MfaChallenge> {
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`${this.loginUrl}?return=${encodeURIComponent(here)}`);

    return new Promise(() => undefined);
  }

  protected requestRenewal(): Promise<AuthResult<U>> {
    return Promise.resolve({ ok: false, reason: 'expired' });
  }

  protected requestIdentity(): Promise<AuthResult<U>> {
    return Promise.resolve({ ok: false, reason: 'missing' });
  }

  protected async requestLogout(): Promise<void> {
    await fetch(this.logoutUrl, { method: 'POST', credentials: 'same-origin' });
  }

  /**
   * Nothing to confirm from here: the page cannot see its own session, and the server answers who is signed in on
   * every page it serves. The session stands as the server rendered it until the server says otherwise.
   */
  revalidate(): Promise<boolean> {
    return Promise.resolve(this.getState() === 'authenticated');
  }
}

export default ServerAuthProvider;
